export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { buildFeedIndex, getFeedStatus } from '@/lib/feed';
import { getModel } from '@/lib/ai';

export async function GET() {
  const db = getDb();
  return Response.json(getFeedStatus(db));
}

export async function POST() {
  const db     = getDb();
  const status = getFeedStatus(db);

  if (status.status === 'building') {
    return Response.json({ error: 'Index build already in progress' }, { status: 409 });
  }

  // Fire-and-forget — updates feed_config as it progresses
  buildFeedIndex(db, getModel()).catch(err => {
    console.error('[feed] Index build failed:', err);
  });

  return Response.json({ ok: true, message: 'Index build started' });
}
