import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({ 
  className, 
  variant = 'default', 
  size = 'default', 
  ...props 
}) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300";
  
  const variantClasses = 
    variant === 'destructive' 
      ? "bg-red-500 text-zinc-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-zinc-50 dark:hover:bg-red-900/90" 
      : variant === 'outline' 
        ? "border border-azure-border dark:border-matrix-primary bg-transparent hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-primary dark:text-matrix-secondary" 
        : variant === 'secondary' 
          ? "bg-azure-surface dark:bg-zinc-800 hover:bg-azure-hover dark:hover:bg-zinc-700/80 text-azure-text-primary dark:text-matrix-secondary" 
          : variant === 'ghost' 
            ? "hover:bg-azure-hover dark:hover:bg-matrix-primary/50 text-azure-text-primary dark:text-matrix-secondary" 
            : variant === 'link' 
              ? "text-azure-primary dark:text-matrix-highlight underline-offset-4 hover:underline" 
              : "bg-azure-primary dark:bg-matrix-highlight text-azure-text-inverse dark:text-black hover:bg-azure-primary/90 dark:hover:bg-matrix-highlight/90";
  
  const sizeClasses = 
    size === 'sm' 
      ? "h-9 px-3 rounded-md" 
      : size === 'lg' 
        ? "h-11 px-8 rounded-md" 
        : size === 'icon' 
          ? "h-10 w-10" 
          : "h-10 px-4 py-2";
  
  const classes = `${baseClasses} ${variantClasses} ${sizeClasses} ${className || ''}`;
  
  return (
    <button className={classes} {...props} />
  );
};