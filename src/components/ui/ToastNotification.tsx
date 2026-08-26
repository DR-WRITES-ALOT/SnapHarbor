import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import type { ToastMessage } from "../../types";

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  const getIcon = (type: ToastMessage["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />;
      case "warning":
        return <AlertTriangle size={18} className="text-amber-400 shrink-0" />;
      case "error":
        return <AlertCircle size={18} className="text-rose-400 shrink-0" />;
      default:
        return <Info size={18} className="text-blue-400 shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastMessage["type"]) => {
    switch (type) {
      case "success":
        return "border-emerald-500/30 bg-[#0c1f17]/90 shadow-[0_8px_32px_rgba(16,185,129,0.15)]";
      case "warning":
        return "border-amber-500/30 bg-[#241a0d]/90 shadow-[0_8px_32px_rgba(245,158,11,0.15)]";
      case "error":
        return "border-rose-500/30 bg-[#250d13]/90 shadow-[0_8px_32px_rgba(244,63,94,0.15)]";
      default:
        return "border-blue-500/30 bg-[#0d1627]/90 shadow-[0_8px_32px_rgba(59,130,246,0.15)]";
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
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`p-4 rounded-2xl border backdrop-blur-xl pointer-events-auto flex items-start gap-3 relative select-none ${getBorderColor(
              toast.type
            )}`}
          >
            <div className="mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 min-w-0 pr-4">
              <div className="text-xs font-semibold text-content-primary leading-tight">
                {toast.title}
              </div>
              <div className="text-[11px] text-content-secondary mt-0.5 leading-relaxed break-words">
                {toast.description}
              </div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
