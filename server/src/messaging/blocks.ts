import type { PrismaService } from '../prisma/prisma.service.js';

/** How a block stands between two people, from the first one's side. */
export async function blockBetween(prisma: PrismaService, me: string, other: string): Promise<'BY_YOU' | 'BY_THEM' | null> {
  const rows = await prisma.userBlock.findMany({
    where: { unblockedAt: null, OR: [{ blockerId: me, blockedId: other }, { blockerId: other, blockedId: me }] },
    select: { blockerId: true },
  });
  if (rows.some((r) => r.blockerId === me)) return 'BY_YOU';
  if (rows.length) return 'BY_THEM';
  return null;
}
