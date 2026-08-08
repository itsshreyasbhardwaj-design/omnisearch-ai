import { Search } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="border-beam/30 bg-beam/10 text-beam flex size-8 items-center justify-center rounded-md border">
            <Search className="size-4" />
          </div>
          <span className="text-ink text-sm font-semibold tracking-tight">OmniSearch AI</span>
        </div>
        {children}
      </div>
    </div>
  );
}
