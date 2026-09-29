import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders badge with default variant', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toBeInTheDocument();
    const badge = screen.getByText('Default').closest('span');
    expect(badge).toHaveClass('bg-primary/10');
  });

  it('applies variant classes correctly', () => {
    const { rerender } = render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText('Error').closest('span')).toHaveClass('bg-destructive/10');

    rerender(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success').closest('span')).toHaveClass('bg-success/10');

    rerender(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText('Warning').closest('span')).toHaveClass('bg-warning/10');
  });

  it('applies outline variant', () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText('Outline').closest('span')).toHaveClass('border');
  });

  it('applies size classes', () => {
    render(<Badge size="lg">Large</Badge>);
    expect(screen.getByText('Large').closest('span')).toHaveClass('px-3');
  });
});