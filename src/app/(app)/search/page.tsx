import type { Metadata } from 'next';
import { SearchPanel } from '@/components/search/search-panel';

export const metadata: Metadata = { title: 'Search' };

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-ink text-lg font-semibold">Search</h1>
      <SearchPanel initialQuery={q} />
    </div>
  );
}
