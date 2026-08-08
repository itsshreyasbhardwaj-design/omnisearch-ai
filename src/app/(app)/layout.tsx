import { getCurrentUser } from '@/lib/auth/guard';
import { TopNav } from '@/components/layout/top-nav';
import { CommandPaletteProvider } from '@/components/layout/command-palette';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen flex-col">
        <TopNav userEmail={user?.email ?? ''} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </CommandPaletteProvider>
  );
}
