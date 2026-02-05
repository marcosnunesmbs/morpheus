import React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({ 
  checked, 
  onCheckedChange, 
  className,
  ...props 
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onCheckedChange) {
      onCheckedChange(e.target.checked);
    }
    if (props.onChange) {
      props.onChange(e);
    }
  };

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={handleChange}
      className={`h-4 w-4 rounded border-azure-border dark:border-matrix-primary bg-azure-surface dark:bg-zinc-900 text-azure-primary dark:text-matrix-highlight focus:ring-azure-primary dark:focus:ring-matrix-highlight ${className || ''}`}
      {...props}
    />
  );
};