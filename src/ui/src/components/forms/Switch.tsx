import { twMerge } from 'tailwind-merge';

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helperText?: string;
  disabled?: boolean;
}

export function Switch({ label, checked, onChange, helperText, disabled }: SwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className={twMerge("text-sm font-medium text-matrix-highlight/80", disabled && "opacity-50")}>{label}</span>
        {helperText && <span className="text-xs text-matrix-secondary">{helperText}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={twMerge(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-matrix-highlight focus:ring-offset-2 focus:ring-offset-black",
          checked ? "bg-matrix-highlight" : "bg-matrix-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={twMerge(
            "inline-block h-4 w-4 transform rounded-full bg-black transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
