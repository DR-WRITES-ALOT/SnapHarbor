import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { useSync } from "../../context/SyncContext";

export const ToastNotification: React.FC = () => {
  const { toasts, dismissToast } = useSync();

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />;
      case "warning":
        return <AlertTriangle size={18} className="text-amber-400 shrink-0" />;
      case "error":
        return <XCircle size={18} className="text-rose-400 shrink-0" />;
      default:
        return <Info size={18} className="text-blue-400 shrink-0" />;
    }
  };

  const getBorder = (type: string) => {
    switch (type) {
      case "success":
        return "border-emerald-500/30 bg-emerald-950/40";
      case "warning":
        return "border-amber-500/30 bg-amber-950/40";
      case "error":
        return "border-rose-500/30 bg-rose-950/40";
      default:
        return "border-blue-500/30 bg-blue-950/40";
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-3 text-xs ${getBorder(
              toast.type
            )}`}
          >
            <div className="mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="font-semibold text-content-primary">{toast.title}</span>
              <span className="text-content-secondary break-words leading-relaxed">
                {toast.description}
              </span>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-content-secondary hover:text-content-primary transition-colors cursor-pointer p-0.5"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
