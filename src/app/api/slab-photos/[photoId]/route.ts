import { db } from '@/lib/db';
import { getSessionContext } from '@/lib/domain/auth';
import { readSlabPhoto } from '@/lib/storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const ctx = await getSessionContext();
  if (!ctx) return new Response('Unauthorized', { status: 401 });

  const { photoId } = await params;
  const photo = await db.slabPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return new Response('Not found', { status: 404 });

  const { data, contentType } = await readSlabPhoto(photo.storageKey);
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
