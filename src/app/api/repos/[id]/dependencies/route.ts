import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { getOwnedRepository } from '@/lib/repos/repoService';
import { whatFileImports, whatImportsFile } from '@/lib/dependencies/queries';
import { apiError, toApiError } from '@/lib/api/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    getOwnedRepository(user.id, id);

    const filePath = new URL(request.url).searchParams.get('file');
    if (!filePath) {
      return apiError('Provide a ?file= query parameter.', 'missing-file', 400);
    }

    return NextResponse.json({
      file: filePath,
      imports: whatFileImports(id, filePath),
      importedBy: whatImportsFile(id, filePath),
    });
  } catch (error) {
    return toApiError(error);
  }
}
