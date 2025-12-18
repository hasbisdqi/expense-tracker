import { motion } from "framer-motion";
import { ThemeSelector } from "@/components/more/ThemeSelector";
import { ExportData } from "@/components/more/ExportData";
import { ImportData } from "@/components/more/ImportData";
import { AboutSection } from "@/components/more/AboutSection";
import { FactoryReset } from "@/components/more/FactoryReset";

export default function MorePage() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-semibold">More</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-6"
      >
        {/* Appearance */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            🎨 Appearance
          </h2>
          <ThemeSelector />
        </div>

        {/* Data Management */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            📤 Data Management
          </h2>
          <ExportData />
          <div className="border-t border-border pt-4">
            <ImportData />
          </div>
        </div>

        {/* About */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            ℹ️ About
          </h2>
          <AboutSection />
        </div>

        {/* Danger Zone */}
        <div className="p-4 rounded-xl bg-card border border-destructive/30 space-y-4">
          <h2 className="font-medium flex items-center gap-2 text-destructive">
            ⚠️ Danger Zone
          </h2>
          <FactoryReset />
        </div>
      </motion.div>
    </div>
  );
}
