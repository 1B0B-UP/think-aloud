export const runtime = 'nodejs';

import { getDb } from '@/lib/db';
import { getTopicsWithContent } from '@/lib/feed';

export async function GET() {
  const db  = getDb();
  const ids = getTopicsWithContent(db);
  return Response.json({ ids });
}
