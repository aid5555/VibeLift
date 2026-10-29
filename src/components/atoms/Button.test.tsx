import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/atoms/Button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Start workout</Button>);
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeInTheDocument();
  });

  it('invokes onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the primary variant by default', () => {
    render(<Button>Primary</Button>);
    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass(
      'bg-blue-600',
    );
  });
});
