import React from 'react';
import { Menu } from 'lucide-react';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-azure-surface dark:bg-zinc-950 border-b border-azure-border dark:border-matrix-primary p-4 flex items-center justify-between">
      <h1 className="text-lg font-bold text-azure-primary dark:text-matrix-highlight flex items-center gap-2">
        <span className="w-6 h-6 flex items-center justify-center">.neo</span>
        MORPHEUS
      </h1>
      <button
        onClick={onMenuClick}
        className="p-2 rounded hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-muted dark:text-matrix-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-azure-primary dark:focus:ring-matrix-secondary"
        aria-label="Abrir menu"
      >
        <Menu className="w-6 h-6" />
      </button>
    </header>
  );
}