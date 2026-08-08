'use client';

import * as React from 'react';
import { ChevronRight, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileTreeEntry {
  path: string;
  language: string | null;
}

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: Map<string, TreeNode>;
}

function buildTree(files: FileTreeEntry[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isFile: false, children: new Map() };
  for (const file of files) {
    const segments = file.path.split('/');
    let node = root;
    let currentPath = '';
    segments.forEach((segment, i) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = i === segments.length - 1;
      let child = node.children.get(segment);
      if (!child) {
        child = { name: segment, path: currentPath, isFile, children: new Map() };
        node.children.set(segment, child);
      }
      node = child;
    });
  }
  return root;
}

function sortedChildren(node: TreeNode): TreeNode[] {
  return Array.from(node.children.values()).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

interface FileTreeProps {
  files: FileTreeEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function FileTree({ files, selectedPath, onSelect }: FileTreeProps) {
  const root = React.useMemo(() => buildTree(files), [files]);

  return (
    <div className="flex flex-col overflow-auto py-1 text-[13px]">
      {sortedChildren(root).map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(depth < 1);

  if (node.isFile) {
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        className={cn(
          'text-ink-muted hover:bg-hover hover:text-ink flex items-center gap-1.5 py-1 pr-2 text-left transition-colors',
          selectedPath === node.path && 'bg-beam/10 text-beam',
        )}
        title={node.path}
      >
        <File className="text-ink-faint size-3.5 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  const children = sortedChildren(node);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        className="text-ink-muted hover:bg-hover hover:text-ink flex w-full items-center gap-1 py-1 pr-2 text-left transition-colors"
      >
        <ChevronRight
          className={cn('size-3.5 shrink-0 transition-transform', expanded && 'rotate-90')}
        />
        <Folder className="text-ink-faint size-3.5 shrink-0" />
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {expanded &&
        children.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}
