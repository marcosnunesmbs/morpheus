import React from 'react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
}

export const Alert: React.FC<AlertProps> = ({ 
  className, 
  variant = 'default', 
  ...props 
}) => {
  const variantClasses = 
    variant === 'destructive' 
      ? "border-red-500/50 text-red-700 dark:border-red-900/50 dark:text-red-300" 
      : "border-azure-border dark:border-matrix-primary";
  
  const classes = `relative w-full rounded-lg border p-4 ${variantClasses} ${className || ''}`;
  
  return (
    <div className={classes} {...props} />
  );
};

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
export const AlertDescription: React.FC<AlertDescriptionProps> = ({ className, ...props }) => (
  <div className={`text-sm [&_p]:leading-relaxed ${className || ''}`} {...props} />
);