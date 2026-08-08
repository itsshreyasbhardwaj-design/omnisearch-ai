'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

type Tab = 'github' | 'local' | 'zip';

export function AddRepoDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>('github');
  const [githubUrl, setGithubUrl] = React.useState('');
  const [localPath, setLocalPath] = React.useState('');
  const [zipFile, setZipFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setGithubUrl('');
    setLocalPath('');
    setZipFile(null);
    setName('');
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let response: Response;
      if (tab === 'zip') {
        if (!zipFile) {
          setError('Choose a .zip file first.');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.set('file', zipFile);
        if (name) formData.set('name', name);
        response = await fetch('/api/repos', { method: 'POST', body: formData });
      } else {
        response = await fetch('/api/repos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            tab === 'github'
              ? { sourceType: 'github', url: githubUrl, name: name || undefined }
              : { sourceType: 'local', path: localPath, name: name || undefined },
          ),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message ?? 'Could not add this repository.');
        return;
      }

      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="size-3.5" />
          Add repository
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a repository</DialogTitle>
          <DialogDescription>
            Indexing happens on this server — nothing is uploaded anywhere else.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="github">GitHub URL</TabsTrigger>
              <TabsTrigger value="local">Local path</TabsTrigger>
              <TabsTrigger value="zip">ZIP upload</TabsTrigger>
            </TabsList>

            <TabsContent value="github" className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor="github-url">Public repository URL</Label>
              <Input
                id="github-url"
                placeholder="https://github.com/owner/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                required={tab === 'github'}
              />
            </TabsContent>

            <TabsContent value="local" className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor="local-path">Absolute path on this machine</Label>
              <Input
                id="local-path"
                placeholder="/Users/you/code/my-project"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                required={tab === 'local'}
              />
            </TabsContent>

            <TabsContent value="zip" className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor="zip-file">Archive (.zip)</Label>
              <label
                htmlFor="zip-file"
                className="border-line-strong bg-raised/40 text-ink-faint hover:border-beam/50 hover:text-ink-muted flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-xs transition-colors"
              >
                <Upload className="size-4" />
                {zipFile ? zipFile.name : 'Click to choose a .zip file'}
                <input
                  id="zip-file"
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="repo-name">Display name (optional)</Label>
            <Input
              id="repo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Defaults from the source"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-sm border px-3 py-2 text-xs"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading && <Spinner className="text-void" />}
              {loading ? 'Indexing…' : 'Add repository'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
