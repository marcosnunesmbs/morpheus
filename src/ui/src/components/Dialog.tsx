import React from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-azure-surface dark:bg-zinc-900 rounded-lg border border-azure-border dark:border-matrix-primary shadow-lg w-full max-w-md md:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
};

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

export const DialogContent: React.FC<DialogContentProps> = ({ className, children }) => {
  return (
    <div className={`relative bg-azure-surface dark:bg-zinc-900 rounded-lg border border-azure-border dark:border-matrix-primary shadow-lg w-full max-w-md md:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ${className}`}>
      <div className="overflow-y-auto flex-grow p-6">
        {children}
      </div>
    </div>
  );
};

interface DialogHeaderProps {
  children: React.ReactNode;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => {
  return (
    <div className="flex flex-col space-y-1.5 text-center sm:text-left border-b border-azure-border dark:border-matrix-primary p-6">
      {children}
    </div>
  );
};

interface DialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ className, children }) => {
  return (
    <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h3>
  );
};

interface DialogFooterProps {
  className?: string;
  children: React.ReactNode;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ className, children }) => {
  return (
    <div className={`mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}>
      {children}
    </div>
  );
};