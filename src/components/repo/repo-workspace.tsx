'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileTree, type FileTreeEntry } from './file-tree';
import { DependenciesPanel } from './dependencies-panel';
import { CodeViewer } from '@/components/viewer/code-viewer';
import { SearchPanel } from '@/components/search/search-panel';
import { Spinner } from '@/components/ui/spinner';
import type { RepositoryRow } from '@/types/db';

interface RepoWorkspaceProps {
  repo: RepositoryRow;
  initialFiles: FileTreeEntry[];
}

interface FileContentState {
  path: string;
  content: string;
  language: string | null;
}

export function RepoWorkspace({ repo, initialFiles }: RepoWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPath = searchParams.get('file');

  const [fileState, setFileState] = React.useState<FileContentState | null>(null);
  const [loadingFile, setLoadingFile] = React.useState(false);
  const languageByPath = React.useMemo(
    () => new Map(initialFiles.map((f) => [f.path, f.language])),
    [initialFiles],
  );

  const loadFile = React.useCallback(
    async (path: string) => {
      setLoadingFile(true);
      try {
        const response = await fetch(
          `/api/files/${repo.id}/${path.split('/').map(encodeURIComponent).join('/')}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        setFileState({ path, content: data.content, language: languageByPath.get(path) ?? null });
      } finally {
        setLoadingFile(false);
      }
    },
    [repo.id, languageByPath],
  );

  React.useEffect(() => {
    // Fetches file content in response to the `?file=` URL param changing —
    // an external data fetch, not derivable state, so this is exactly what
    // effects are for despite the lint rule's default suspicion of setState.
    if (selectedPath && selectedPath !== fileState?.path) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadFile(selectedPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath]);

  function selectFile(path: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('file', path);
    params.delete('L');
    router.push(`?${params.toString()}`, { scroll: false });
  }

  const [activeTab, setActiveTab] = React.useState<'browse' | 'search'>('browse');

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as 'browse' | 'search')}
      className="flex h-[calc(100vh-8.5rem)] flex-col gap-3"
    >
      <TabsList className="w-fit">
        <TabsTrigger value="browse">Browse</TabsTrigger>
        <TabsTrigger value="search">Search this repository</TabsTrigger>
      </TabsList>

      <TabsContent value="browse" className="flex flex-1 gap-3 overflow-hidden">
        <div className="border-line w-64 shrink-0 overflow-hidden rounded-md border">
          <FileTree files={initialFiles} selectedPath={selectedPath} onSelect={selectFile} />
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
          {!selectedPath ? (
            <div className="border-line-strong text-ink-faint flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed">
              <FileText className="size-6" />
              <p className="text-xs">Select a file to view it</p>
            </div>
          ) : loadingFile || !fileState ? (
            <div className="border-line flex h-full items-center justify-center rounded-md border">
              <Spinner />
            </div>
          ) : (
            <>
              <DependenciesPanel repoId={repo.id} filePath={fileState.path} />
              <div className="min-h-0 flex-1">
                <CodeViewer
                  filePath={fileState.path}
                  content={fileState.content}
                  language={fileState.language}
                />
              </div>
            </>
          )}
        </div>
      </TabsContent>

      <TabsContent value="search" className="flex-1 overflow-auto">
        <SearchPanel
          repoId={repo.id}
          repoName={repo.name}
          onResultOpen={() => setActiveTab('browse')}
        />
      </TabsContent>
    </Tabs>
  );
}
