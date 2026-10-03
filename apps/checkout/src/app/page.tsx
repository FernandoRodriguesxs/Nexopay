import { notFound } from 'next/navigation';

// O checkout só é acessado via /p/:paymentId.
export default function CheckoutRootPage() {
  notFound();
}
