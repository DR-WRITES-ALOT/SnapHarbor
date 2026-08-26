import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar, NavTab } from "./components/layout/Sidebar";
import { Dashboard } from "./components/layout/Dashboard";
import { StorageView } from "./components/layout/StorageView";
import { SettingsView } from "./components/layout/SettingsView";
import { ToastNotification } from "./components/ui/ToastNotification";
import { SyncProvider, useSync } from "./context/SyncContext";
import "./App.css";

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const { toasts, dismissToast } = useSync();

  return (
    <main className="w-screen h-full min-h-screen overflow-hidden relative flex bg-base text-content-primary font-sans selection:bg-content-accent/30">
      {/* Background Ambient Gradient Layer */}
      <div className="absolute inset-0 z-[-2] bg-gradient-to-br from-[#0a0a14] via-[#120f26] to-[#0a0a14]">
        <div
          className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)",
          }}
        />
      </div>

      {/* Dark Tint Overlay */}
      <div className="absolute inset-0 z-[-1] bg-black/40 backdrop-blur-[2px] pointer-events-none" />

      {/* Main Navigation Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Dynamic View Tab Rendering with smooth fade animation */}
      <div className="flex-1 h-full overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              <Dashboard onNavigateToSettings={() => setActiveTab("settings")} />
            </motion.div>
          )}

          {activeTab === "storage" && (
            <motion.div
              key="storage"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              <StorageView />
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              <SettingsView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast Alert Popups */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}

function App() {
  return (
    <SyncProvider>
      <AppContent />
    </SyncProvider>
  );
}

export default App;
