import type { ReactElement, ReactNode } from 'react';

export interface CardProps {
  title?: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps): ReactElement {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {title ? (
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}
