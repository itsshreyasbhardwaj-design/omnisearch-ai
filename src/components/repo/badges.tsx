import { Badge } from '@/components/ui/badge';
import type { RepoSourceType, RepoStatus } from '@/types/db';
import type { MatchType } from '@/lib/search/types';

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

const MATCH_TYPE_VARIANT: Record<MatchType, 'beam' | 'match' | 'default'> = {
  'TEXT MATCH': 'match',
  'REGEX MATCH': 'beam',
  'SYMBOL MATCH': 'default',
  'SEMANTIC MATCH': 'beam',
  'HYBRID MATCH': 'beam',
};

export function MatchTypeBadge({ matchType }: { matchType: MatchType }) {
  return <Badge variant={MATCH_TYPE_VARIANT[matchType]}>{matchType}</Badge>;
}
