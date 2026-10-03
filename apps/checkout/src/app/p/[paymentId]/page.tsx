import { hasIdPrefix } from '@nexopay/contracts';
import { notFound } from 'next/navigation';

// Placeholder do bootstrap: a busca do Payment e o QR Code PIX
// são implementados nas etapas seguintes.
export default async function CheckoutPage({ params }: PageProps<'/p/[paymentId]'>) {
  const { paymentId } = await params;
  if (!hasIdPrefix(paymentId, 'pay')) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <p className="text-sm text-ink-secondary">Pagamento</p>
      <h1 className="font-mono text-lg">{paymentId}</h1>
    </main>
  );
}
