import React from "react";
import { Home, Cloud, HardDrive, Settings, Smartphone, Images } from "lucide-react";
import { useSync } from "../../context/SyncContext";

export type NavTab = "home" | "gallery" | "storage" | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { devices, isSyncing } = useSync();

  return (
    <div className="w-24 h-full py-8 flex flex-col items-center justify-between border-r border-white/5 bg-glass/30 backdrop-blur-glass-md z-10 relative shadow-[4px_0_24px_rgba(0,0,0,0.2)] select-none">
      <div className="flex flex-col gap-8 items-center">
        {/* App Logo / Brand */}
        <div className="relative group cursor-pointer" onClick={() => onSelectTab("home")}>
          <div className="w-12 h-12 rounded-2xl bg-content-accent/20 text-content-accent flex items-center justify-center hover:bg-content-accent/30 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)]">
            <Cloud size={24} className={isSyncing ? "animate-pulse" : ""} />
          </div>
          {isSyncing && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-[#0a0a14] animate-ping" />
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col gap-4 mt-2 text-content-secondary">
          <button
            onClick={() => onSelectTab("home")}
            title="Dashboard (Device Sync)"
            className={`p-3 rounded-2xl transition-all duration-300 cursor-pointer ${
              activeTab === "home"
                ? "text-content-primary bg-glass shadow-glass border border-white/10"
                : "hover:text-content-primary hover:bg-glass-light"
            }`}
          >
            <Home size={22} />
          </button>

          <button
            onClick={() => onSelectTab("gallery")}
            title="Vault Photo Gallery"
            className={`p-3 rounded-2xl transition-all duration-300 cursor-pointer ${
              activeTab === "gallery"
                ? "text-content-primary bg-glass shadow-glass border border-white/10"
                : "hover:text-content-primary hover:bg-glass-light"
            }`}
          >
            <Images size={22} />
          </button>

          <button
            onClick={() => onSelectTab("storage")}
            title="Storage & Sync History"
            className={`p-3 rounded-2xl transition-all duration-300 cursor-pointer ${
              activeTab === "storage"
                ? "text-content-primary bg-glass shadow-glass border border-white/10"
                : "hover:text-content-primary hover:bg-glass-light"
            }`}
          >
            <HardDrive size={22} />
          </button>

          <button
            onClick={() => onSelectTab("settings")}
            title="Settings & Preferences"
            className={`p-3 rounded-2xl transition-all duration-300 cursor-pointer ${
              activeTab === "settings"
                ? "text-content-primary bg-glass shadow-glass border border-white/10"
                : "hover:text-content-primary hover:bg-glass-light"
            }`}
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* Bottom Status / Device Indicator */}
      <div className="flex flex-col gap-2 items-center text-content-secondary">
        <div
          title={`${devices.length} device(s) connected`}
          className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-content-secondary"
        >
          <Smartphone size={18} className={devices.length > 0 ? "text-emerald-400" : ""} />
        </div>
        <span className="text-[10px] text-content-secondary font-mono">v0.1</span>
      </div>
    </div>
  );
};
