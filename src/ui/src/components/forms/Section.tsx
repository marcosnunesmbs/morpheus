import { type ReactNode } from 'react';

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <div className="border border-matrix-primary rounded-lg p-6 bg-matrix-base/50">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-matrix-highlight">{title}</h3>
        {description && (
          <p className="text-sm text-matrix-secondary mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
