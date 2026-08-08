import { Badge } from '@/components/ui/badge';
import type { RepoSourceType, RepoStatus } from '@/types/db';

const STATUS_VARIANT: Record<RepoStatus, 'default' | 'beam' | 'ready' | 'danger'> = {
  pending: 'default',
  indexing: 'beam',
  ready: 'ready',
  error: 'danger',
};

const STATUS_LABEL: Record<RepoStatus, string> = {
  pending: 'Pending',
  indexing: 'Indexing…',
  ready: 'Ready',
  error: 'Error',
};

export function StatusBadge({ status }: { status: RepoStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

const SOURCE_LABEL: Record<RepoSourceType, string> = {
  github: 'GitHub',
  local: 'Local',
  zip: 'ZIP',
};

export function SourceBadge({ sourceType }: { sourceType: RepoSourceType }) {
  return <Badge>{SOURCE_LABEL[sourceType]}</Badge>;
}

export function MatchTypeBadge({ matchType }: { matchType: 'TEXT MATCH' | 'REGEX MATCH' }) {
  return <Badge variant={matchType === 'REGEX MATCH' ? 'beam' : 'match'}>{matchType}</Badge>;
}
