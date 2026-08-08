'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Moon, Search, Sun, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from './theme-provider';
import { useCommandPalette } from './command-palette';

export function TopNav({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { open: openPalette } = useCommandPalette();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-line bg-void/85 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="border-beam/30 bg-beam/10 text-beam flex size-7 items-center justify-center rounded-sm border">
            <Search className="size-3.5" />
          </div>
          <span className="text-ink text-sm font-semibold tracking-tight">OmniSearch AI</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <Button variant={pathname === '/dashboard' ? 'subtle' : 'ghost'} size="sm" asChild>
            <Link href="/dashboard">
              <LayoutGrid className="size-3.5" />
              Repositories
            </Link>
          </Button>
          <Button variant={pathname?.startsWith('/search') ? 'subtle' : 'ghost'} size="sm" asChild>
            <Link href="/search">
              <Search className="size-3.5" />
              Search
            </Link>
          </Button>
        </nav>

        <button
          type="button"
          onClick={openPalette}
          className="border-line bg-raised/50 text-ink-faint hover:border-line-strong hover:text-ink-muted ml-auto flex h-8 w-56 items-center gap-2 rounded-md border px-2.5 text-xs transition-colors"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>

        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              {userEmail || 'Account'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{userEmail}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout}>
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
