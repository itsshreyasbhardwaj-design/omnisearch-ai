'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { FolderGit2, LayoutGrid, Search } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { RepositoryRow } from '@/types/db';

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [repos, setRepos] = React.useState<RepositoryRow[]>([]);

  const open = React.useCallback(() => setIsOpen(true), []);

  React.useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }
      if (event.key === '/' && !isOpen) {
        const target = event.target as HTMLElement | null;
        const isTyping =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable;
        if (!isTyping) {
          event.preventDefault();
          router.push('/search');
        }
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isOpen, router]);

  React.useEffect(() => {
    if (!isOpen || repos.length > 0) return;
    fetch('/api/repos')
      .then((r) => r.json())
      .then((data) => setRepos(data.repositories ?? []))
      .catch(() => undefined);
  }, [isOpen, repos.length]);

  function runSearch() {
    setIsOpen(false);
    router.push(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search');
    setQuery('');
  }

  return (
    <CommandPaletteContext.Provider value={{ open }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent showClose={false} className="max-w-lg overflow-hidden p-0">
          <Command className="flex flex-col" shouldFilter loop>
            <div className="border-line flex items-center gap-2 border-b px-3">
              <Search className="text-ink-faint size-4" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search everywhere, or jump to a repository…"
                className="text-ink placeholder:text-ink-faint h-11 flex-1 bg-transparent text-sm outline-none"
              />
              <kbd className="border-line-strong text-ink-faint rounded-xs border px-1 text-[10px]">
                esc
              </kbd>
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-1.5">
              <Command.Empty className="text-ink-faint px-3 py-6 text-center text-xs">
                No matches.
              </Command.Empty>

              <Command.Group
                heading="Actions"
                className="[&_[cmdk-group-heading]]:text-ink-faint [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase"
              >
                <Command.Item
                  onSelect={runSearch}
                  className="text-ink data-[selected=true]:bg-hover flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm"
                >
                  <Search className="text-beam size-3.5" />
                  Search{query ? ` for "${query}"` : ' everywhere'}
                </Command.Item>
                <Command.Item
                  onSelect={() => {
                    setIsOpen(false);
                    router.push('/dashboard');
                  }}
                  className="text-ink data-[selected=true]:bg-hover flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm"
                >
                  <LayoutGrid className="text-ink-muted size-3.5" />
                  Go to repositories
                </Command.Item>
              </Command.Group>

              {repos.length > 0 && (
                <Command.Group
                  heading="Repositories"
                  className="[&_[cmdk-group-heading]]:text-ink-faint [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase"
                >
                  {repos.map((repo) => (
                    <Command.Item
                      key={repo.id}
                      value={repo.name}
                      onSelect={() => {
                        setIsOpen(false);
                        router.push(`/repos/${repo.id}`);
                      }}
                      className="text-ink data-[selected=true]:bg-hover flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm"
                    >
                      <FolderGit2 className="text-ink-muted size-3.5" />
                      {repo.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </CommandPaletteContext.Provider>
  );
}
