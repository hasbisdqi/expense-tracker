import { db } from "./expenseTrackerDb";
import { supabase } from "@/lib/supabase";
import { SyncQueueItem } from "@/types/expense";
import { v4 as uuidv4 } from "uuid";

let isSyncing = false;
const SYNCABLE_TABLES = ["expenses", "categories", "accounts"];

import Dexie from "dexie";

// Capture local Dexie changes via hooks
let pendingChanges: SyncQueueItem[] = [];

function createSyncItem(
  action: "insert" | "update" | "delete",
  table: string,
  recordId: string,
  data?: any
): SyncQueueItem {
  return {
    id: uuidv4(),
    action,
    table,
    recordId,
    data,
    createdAt: new Date().toISOString(),
  };
}

let flushTimeout: any = null;
function flushPendingChanges() {
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(async () => {
    if (pendingChanges.length === 0) return;
    const items = [...pendingChanges];
    pendingChanges = [];
    try {
      await db.sync_queue.bulkAdd(items);
      processSyncQueue();
    } catch (e) {
      console.error("Could not write to sync_queue", e);
    }
  }, 50);
}

SYNCABLE_TABLES.forEach((tableName) => {
  const table = db.table(tableName);

  table.hook("creating", function (primKey, obj, trans) {
    if ((window as any).__applyingDownstreamSync) return;
    pendingChanges.push(createSyncItem("insert", tableName, primKey as string, obj));
    trans.on("complete", flushPendingChanges);
  });

  table.hook("updating", function (mods, primKey, obj, trans) {
    if ((window as any).__applyingDownstreamSync) return;
    const newData = { ...obj };
    for (const key in mods) {
      if ((mods as any)[key] === undefined) delete (newData as any)[key];
      else (newData as any)[key] = (mods as any)[key];
    }
    pendingChanges.push(createSyncItem("update", tableName, primKey as string, newData));
    trans.on("complete", flushPendingChanges);
  });

  table.hook("deleting", function (primKey, obj, trans) {
    if ((window as any).__applyingDownstreamSync) return;
    pendingChanges.push(createSyncItem("delete", tableName, primKey as string));
    trans.on("complete", flushPendingChanges);
  });
});

function toSupabase(table: string, obj: any, userId: string) {
  if (!obj) return null;
  if (table === "accounts" || table === "categories") {
    return {
      id: obj.id,
      user_id: obj.user_id || userId,
      name: obj.name,
      icon: obj.icon,
      color: obj.color,
      is_default: obj.isDefault || false,
      created_at: obj.createdAt,
      updated_at: obj.updatedAt || new Date().toISOString()
    };
  } else if (table === "expenses") {
    return {
      id: obj.id,
      user_id: obj.user_id || userId,
      type: obj.type || "expense",
      amount: obj.value || 0,
      date: obj.date,
      time: obj.time,
      description: obj.description || "",
      category_id: obj.category || null,
      account_id: obj.accountId,
      to_account_id: obj.toAccountId || null,
      is_adhoc: obj.isAdhoc || false,
      attachment: obj.attachment || null,
      tags: obj.tags || [],
      created_at: obj.createdAt,
      updated_at: obj.updatedAt || new Date().toISOString()
    };
  }
  return obj;
}

function fromSupabase(table: string, obj: any) {
  if (!obj) return null;
  if (table === "accounts" || table === "categories") {
    return {
      id: obj.id,
      user_id: obj.user_id,
      name: obj.name,
      icon: obj.icon,
      color: obj.color,
      isDefault: obj.is_default,
      createdAt: obj.created_at,
      updatedAt: obj.updated_at || obj.created_at
    };
  } else if (table === "expenses") {
    return {
      id: obj.id,
      user_id: obj.user_id,
      type: obj.type,
      value: obj.amount,
      date: obj.date,
      time: obj.time,
      description: obj.description,
      category: obj.category_id || "",
      accountId: obj.account_id,
      toAccountId: obj.to_account_id || undefined,
      isAdhoc: obj.is_adhoc,
      attachment: obj.attachment || undefined,
      tags: obj.tags || [],
      createdAt: obj.created_at,
      updatedAt: obj.updated_at || obj.created_at
    };
  }
  return obj;
}

export async function processSyncQueue() {
  if (isSyncing) return;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return; // Cannot sync if not logged in
  
  if (!navigator.onLine) return;

  isSyncing = true;
  try {
    const queue = await db.sync_queue.orderBy("createdAt").toArray();
    if (queue.length === 0) return;

    for (const item of queue) {
      if (item.action === "insert" || item.action === "update") {
        if (!item.data) continue;
        
        // Map Dexie object format to Supabase schema format
        const mappedData = toSupabase(item.table, item.data, session.user.id);
        if (!mappedData) continue;

        const { error } = await supabase
          .from(item.table)
          .upsert(mappedData);
          
        if (!error) {
           await db.sync_queue.delete(item.id);
        } else {
           console.error(`Failed to push to supabase: ${error.message}`);
           break; // Stop processing to keep order, retry later
        }
      } else if (item.action === "delete") {
        const { error } = await supabase
          .from(item.table)
          .delete()
          .eq("id", item.recordId);
          
        if (!error) {
           await db.sync_queue.delete(item.id);
        } else {
           console.error(`Failed to delete from supabase: ${error.message}`);
           break;
        }
      }
    }
  } catch (e) {
    console.error("Sync process error", e);
  } finally {
    isSyncing = false;
  }
}

// Subscribe to online status to sync when connection restores
if (typeof window !== "undefined") {
  window.addEventListener("online", processSyncQueue);
}

// Downstream Sync
export async function startDownstreamSync() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  // 1. Initial Pull (Sync remote facts to local Dexie)
  (window as any).__applyingDownstreamSync = true;
  try {
    for (const table of SYNCABLE_TABLES) {
      // Basic approach: pull everything for local cache. 
      // A more robust approach would track last_sync_time.
      const { data, error } = await supabase.from(table).select("*").eq("user_id", session.user.id);
      // Map remote rows back to local Dexie schema
      if (!error && data && data.length > 0) {
        const localData = data.map(row => fromSupabase(table, row));
        await db.table(table).bulkPut(localData);
      }
    }
  } catch (e) {
    console.error("Failed initial pull from Supabase", e);
  } finally {
    (window as any).__applyingDownstreamSync = false;
  }

  // 2. Realtime Subscription
  supabase
    .channel("public-db-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public" },
      async (payload) => {
        if (!SYNCABLE_TABLES.includes(payload.table)) return;

        (window as any).__applyingDownstreamSync = true;
        try {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const localData = fromSupabase(payload.table, payload.new);
            if (localData) {
              await db.table(payload.table).put(localData);
            }
          } else if (payload.eventType === "DELETE") {
            await db.table(payload.table).delete(payload.old.id);
          }
        } catch (e) {
          console.error("Error applying realtime change locally", e);
        } finally {
          (window as any).__applyingDownstreamSync = false;
        }
      }
    )
    .subscribe();
}
