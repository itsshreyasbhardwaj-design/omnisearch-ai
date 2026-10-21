'use client';

import * as React from 'react';
import { ChevronRight, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VirtualList } from '@/components/ui/virtual-list';

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

export function buildTree(files: FileTreeEntry[]): TreeNode {
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

export interface VisibleRow {
  node: TreeNode;
  depth: number;
}

/** Flattens the tree into the rows actually on screen — only descends into expanded folders. */
export function flattenVisible(
  root: TreeNode,
  expanded: ReadonlySet<string>,
  depth = 0,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  for (const child of sortedChildren(root)) {
    rows.push({ node: child, depth });
    if (!child.isFile && expanded.has(child.path)) {
      rows.push(...flattenVisible(child, expanded, depth + 1));
    }
  }
  return rows;
}

const ROW_HEIGHT = 26;
const VIRTUALIZE_THRESHOLD = 200;

interface FileTreeProps {
  files: FileTreeEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function FileTree({ files, selectedPath, onSelect }: FileTreeProps) {
  const root = React.useMemo(() => buildTree(files), [files]);

  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    // Matches the previous default: top-level folders start open.
    const initial = new Set<string>();
    for (const child of sortedChildren(root)) {
      if (!child.isFile) initial.add(child.path);
    }
    return initial;
  });

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const visibleRows = React.useMemo(() => flattenVisible(root, expanded), [root, expanded]);

  const renderRow = React.useCallback(
    (row: VisibleRow) => (
      <TreeRow
        node={row.node}
        depth={row.depth}
        expanded={expanded.has(row.node.path)}
        selectedPath={selectedPath}
        onSelect={onSelect}
        onToggle={toggle}
      />
    ),
    [expanded, selectedPath, onSelect],
  );

  if (visibleRows.length > VIRTUALIZE_THRESHOLD) {
    return (
      <VirtualList
        className="h-full overflow-auto py-1 text-[13px]"
        itemCount={visibleRows.length}
        itemHeight={ROW_HEIGHT}
        renderItem={(index) => {
          const row = visibleRows[index];
          return row ? renderRow(row) : null;
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto py-1 text-[13px]">
      {visibleRows.map((row) => (
        <div key={row.node.path} style={{ height: ROW_HEIGHT }}>
          {renderRow(row)}
        </div>
      ))}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  expanded,
  selectedPath,
  onSelect,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  if (node.isFile) {
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        className={cn(
          'text-ink-muted hover:bg-hover hover:text-ink flex h-full w-full items-center gap-1.5 pr-2 text-left transition-colors',
          selectedPath === node.path && 'bg-beam/10 text-beam',
        )}
        title={node.path}
      >
        <File className="text-ink-faint size-3.5 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(node.path)}
      style={{ paddingLeft: `${depth * 14 + 4}px` }}
      className="text-ink-muted hover:bg-hover hover:text-ink flex h-full w-full items-center gap-1 pr-2 text-left transition-colors"
    >
      <ChevronRight
        className={cn('size-3.5 shrink-0 transition-transform', expanded && 'rotate-90')}
      />
      <Folder className="text-ink-faint size-3.5 shrink-0" />
      <span className="truncate font-medium">{node.name}</span>
    </button>
  );
}
