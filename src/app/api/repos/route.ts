import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import {
  createGithubRepository,
  createLocalRepository,
  createZipRepository,
  listRepositoriesForUser,
} from '@/lib/repos/repoService';
import { createRepoSchema } from '@/lib/validation/repos';
import { apiError, toApiError } from '@/lib/api/errors';

const MAX_UPLOAD_BYTES = Number(process.env.OMNISEARCH_MAX_UPLOAD_MB ?? 200) * 1024 * 1024;

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ repositories: listRepositoriesForUser(user.id) });
  } catch (error) {
    return toApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const name = formData.get('name');

      if (!(file instanceof File)) {
        return apiError('Attach a .zip file.', 'missing-file', 400);
      }
      if (!file.name.toLowerCase().endsWith('.zip')) {
        return apiError('Only .zip archives are supported.', 'invalid-file-type', 400);
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return apiError(
          `Archive exceeds the ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB upload limit.`,
          'file-too-large',
          413,
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const repo = await createZipRepository(
        user.id,
        buffer,
        file.name,
        typeof name === 'string' ? name : undefined,
      );
      return NextResponse.json({ repository: repo }, { status: 201 });
    }

    const body = await request.json().catch(() => ({}));
    const input = createRepoSchema.parse(body);

    const repo =
      input.sourceType === 'github'
        ? await createGithubRepository(user.id, input.url, input.name)
        : await createLocalRepository(user.id, input.path, input.name);

    return NextResponse.json({ repository: repo }, { status: 201 });
  } catch (error) {
    return toApiError(error);
  }
}
