import type { Metadata } from 'next';
import { SearchPanel } from '@/components/search/search-panel';
import { AskPanel } from '@/components/search/ask-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata: Metadata = { title: 'Search' };

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-ink text-lg font-semibold">Search</h1>
      <Tabs defaultValue="search">
        <TabsList className="w-fit">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="ask">Ask</TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="mt-4">
          <SearchPanel initialQuery={q} />
        </TabsContent>
        <TabsContent value="ask" className="mt-4">
          <AskPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
