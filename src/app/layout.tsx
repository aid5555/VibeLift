import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'VibeLift',
  description: 'AI-powered fitness coaching',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
