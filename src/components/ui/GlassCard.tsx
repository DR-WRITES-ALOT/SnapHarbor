import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-glass backdrop-blur-glass border border-white/10 shadow-glass rounded-glass overflow-hidden ${onClick ? 'cursor-pointer hover:bg-glass-light transition-colors duration-300' : ''} ${className}`}
    >
      <div className="absolute inset-0 shadow-glass-inset pointer-events-none rounded-glass"></div>
      {children}
    </div>
  );
};
