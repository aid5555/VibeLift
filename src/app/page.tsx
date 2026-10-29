import type { ReactElement } from 'react';
import { Button } from '@/components/atoms';
import { Card } from '@/components/molecules';

export default function HomePage(): ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">VibeLift</h1>
        <p className="text-gray-600">Your AI-powered fitness coach.</p>
      </header>

      <Card title="Get started">
        <p className="mb-4 text-gray-700">
          Plan your first workout with a coach that adapts to you.
        </p>
        <Button>Begin your journey</Button>
      </Card>
    </main>
  );
}
