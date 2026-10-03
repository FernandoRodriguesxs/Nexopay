import { EnvironmentBadge } from '@nexopay/ui/components/environment-badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Visão geral' };

// Placeholder do bootstrap. As telas reais são implementadas na Etapa F
// seguindo .claude/skills/nexopay-design.
export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-sidebar p-5 text-sidebar-text">
        <span className="text-sm font-semibold tracking-tight">NexoPay</span>
      </aside>
      <main className="flex-1 p-10">
        <header className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <EnvironmentBadge />
        </header>
      </main>
    </div>
  );
}
