export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { getFeedItems, getFeedItemCount } from '@/lib/feed';

export async function GET(req: Request) {
  const db      = getDb();
  const url     = new URL(req.url);
  const topicId = parseInt(url.searchParams.get('topicId') ?? '0');
  const limit   = Math.min(parseInt(url.searchParams.get('limit')  ?? '20'), 50);
  const offset  = parseInt(url.searchParams.get('offset') ?? '0');

  if (!topicId) {
    return Response.json({ error: 'topicId required' }, { status: 400 });
  }

  const items = getFeedItems(db, topicId, limit, offset);
  const total = getFeedItemCount(db, topicId);

  return Response.json({ items, total, offset, hasMore: offset + items.length < total });
}
