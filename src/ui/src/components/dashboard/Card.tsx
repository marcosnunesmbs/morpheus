import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
export const Card: React.FC<CardProps> = ({ className, ...props }) => (
  <div
    className={`rounded-lg border border-azure-border dark:border-matrix-primary/30 bg-azure-surface dark:bg-zinc-900 text-azure-text-primary dark:text-matrix-secondary shadow-sm ${className || ''}`}
    {...props}
  />
);

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
export const CardHeader: React.FC<CardHeaderProps> = ({ className, ...props }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className || ''}`} {...props} />
);

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
export const CardTitle: React.FC<CardTitleProps> = ({ className, ...props }) => (
  <h3
    className={`text-2xl font-semibold leading-none tracking-tight ${className || ''}`}
    {...props}
  />
);

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
export const CardContent: React.FC<CardContentProps> = ({ className, ...props }) => (
  <div className={`p-6 pt-0 ${className || ''}`} {...props} />
);