import { db } from "./expenseTrackerDb";
import { supabase } from "@/lib/supabase";
import { SyncQueueItem } from "@/types/expense";
import { v4 as uuidv4 } from "uuid";

let isSyncing = false;
const SYNCABLE_TABLES = ["expenses", "categories", "accounts"];

import Dexie from "dexie";

export function toSupabase(table: string, obj: any, userId: string) {
  if (!obj) return null;
  if (table === "accounts" || table === "categories") {
    return {
      id: obj.id,
      user_id: obj.user_id || userId,
      name: obj.name,
      icon: obj.icon,
      color: obj.color,
      is_default: obj.isDefault || false,
      budget: obj.budget || null,
      budget_period: obj.budgetPeriod || null,
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

export function fromSupabase(table: string, obj: any) {
  if (!obj) return null;
  if (table === "accounts" || table === "categories") {
    return {
      id: obj.id,
      user_id: obj.user_id,
      name: obj.name,
      icon: obj.icon,
      color: obj.color,
      isDefault: obj.is_default,
      budget: obj.budget || undefined,
      budgetPeriod: obj.budget_period || undefined,
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
      
      if (!error && data) {
        // Map over what we received
        const localData = data.map(row => fromSupabase(table, row)).filter(Boolean);
        const remoteIds = new Set(data.map(r => r.id));

        // Get everything we currently have locally
        const localIds = await db.table(table).toCollection().primaryKeys();

        // Any local ID that's NOT in the remote IDs was likely deleted from another device.
        let idsToDelete = localIds.filter(id => !remoteIds.has(id));

        // CRITICAL PROTECTION: Do NOT delete local IDs that are currently pending in sync_queue!
        // These are items that failed to upload or haven't uploaded yet.
        const pendingQueue = await db.sync_queue.where("table").equals(table).toArray();
        const pendingIds = new Set(pendingQueue.map(q => q.recordId));
        
        idsToDelete = idsToDelete.filter(id => !pendingIds.has(id as string));

        // Also protect recently created items (last 10 seconds) just in case the sync_queue
        // hook hasn't committed yet during a rapid refresh scenario.
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
        const recentlyCreatedItems = await db.table(table)
          .filter(item => (item.createdAt > tenSecondsAgo) || (item.updatedAt > tenSecondsAgo))
          .toArray();
        const recentIds = new Set(recentlyCreatedItems.map(item => item.id));

        idsToDelete = idsToDelete.filter(id => !recentIds.has(id as string));

        // Perform pruning and applying
        if (idsToDelete.length > 0) {
          await db.table(table).bulkDelete(idsToDelete as any);
        }
        
        if (localData.length > 0) {
          await db.table(table).bulkPut(localData);
        }
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
