import React from 'react';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}
export const Table: React.FC<TableProps> = ({ className, ...props }) => (
  <div className="relative w-full overflow-auto">
    <table
      className={`w-full caption-bottom text-sm ${className}`}
      {...props}
    />
  </div>
);

interface TableHeaderProps extends React.ThHTMLAttributes<HTMLElement> {}
export const TableHeader: React.FC<TableHeaderProps> = ({ ...props }) => (
  <thead {...props} />
);

interface TableBodyProps extends React.HTMLAttributes<HTMLElement> {}
export const TableBody: React.FC<TableBodyProps> = ({ ...props }) => (
  <tbody {...props} />
);

interface TableRowProps extends React.HTMLAttributes<HTMLElement> {}
export const TableRow: React.FC<TableRowProps> = ({ ...props }) => (
  <tr
    className="border-b border-azure-border dark:border-matrix-primary/30 transition-colors hover:bg-azure-hover/50 dark:hover:bg-matrix-primary/10"
    {...props}
  />
);

interface TableHeadProps extends React.ThHTMLAttributes<HTMLElement> {}
export const TableHead: React.FC<TableHeadProps> = ({ className, ...props }) => (
  <th
    className={`h-12 px-4 text-left align-middle font-medium text-azure-text-secondary dark:text-matrix-secondary/70 [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  />
);

interface TableCellProps extends React.TdHTMLAttributes<HTMLElement> {}
export const TableCell: React.FC<TableCellProps> = ({ className, ...props }) => (
  <td
    className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}
    {...props}
  />
);