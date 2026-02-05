import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({ 
  className, 
  variant = 'default', 
  ...props 
}) => {
  const variantClasses = 
    variant === 'destructive' 
      ? "border-transparent bg-red-500 text-zinc-50 dark:bg-red-900 dark:text-zinc-50" 
      : variant === 'secondary' 
        ? "border-transparent bg-azure-surface dark:bg-zinc-800 text-azure-text-secondary dark:text-matrix-secondary" 
        : variant === 'outline' 
          ? "text-azure-text-primary dark:text-matrix-secondary border-azure-border dark:border-matrix-primary" 
          : "border-transparent bg-azure-primary dark:bg-matrix-highlight text-azure-text-inverse dark:text-black";
  
  const classes = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 dark:focus:ring-zinc-300 ${variantClasses} ${className || ''}`;
  
  return (
    <div className={classes} {...props} />
  );
};