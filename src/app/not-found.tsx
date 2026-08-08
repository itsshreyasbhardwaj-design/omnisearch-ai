import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="border-line-strong bg-raised text-ink-faint flex size-10 items-center justify-center rounded-md border">
        <Search className="size-5" />
      </div>
      <div>
        <p className="text-ink text-sm font-semibold">Nothing found here</p>
        <p className="text-ink-muted text-xs">
          The page or repository you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">Back to repositories</Link>
      </Button>
    </div>
  );
}
