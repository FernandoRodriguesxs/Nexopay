import { FlaskConical } from 'lucide-react';
import { cn } from '../lib/utils';

export interface EnvironmentBadgeProps {
  readonly className?: string;
}

/**
 * Indica que o merchant está operando em SANDBOX (sem dinheiro real).
 * Usa ícone + texto: o estado nunca depende apenas de cor.
 */
export function EnvironmentBadge({ className }: EnvironmentBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border border-sandbox-border bg-sandbox-bg px-2 py-0.5 font-mono text-xs font-medium tracking-wide text-sandbox-fg',
        className,
      )}
    >
      <FlaskConical aria-hidden className="size-3.5" />
      SANDBOX
    </span>
  );
}
