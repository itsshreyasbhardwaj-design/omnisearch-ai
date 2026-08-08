import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/guard';

// Middleware normally handles this redirect before rendering ever starts;
// this is the fallback for the rare case a request reaches the page itself.
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? '/dashboard' : '/login');
}
