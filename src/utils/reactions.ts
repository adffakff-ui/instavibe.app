export type ReactionType = 'heart' | 'love' | 'laugh' | 'wow' | 'fire' | 'clap';

export interface ReactionMeta {
  type: ReactionType;
  emoji: string;
  labelAr: string;
  labelEn: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

export const REACTIONS: ReactionMeta[] = [
  {
    type: 'heart',
    emoji: '❤️',
    labelAr: 'إعجاب',
    labelEn: 'Like',
    textClass: 'text-rose-500',
    bgClass: 'bg-rose-50 dark:bg-rose-950/50',
    borderClass: 'border-rose-200 dark:border-rose-800/70',
  },
  {
    type: 'love',
    emoji: '😍',
    labelAr: 'حب',
    labelEn: 'Love',
    textClass: 'text-pink-500',
    bgClass: 'bg-pink-50 dark:bg-pink-950/50',
    borderClass: 'border-pink-200 dark:border-pink-800/70',
  },
  {
    type: 'laugh',
    emoji: '😂',
    labelAr: 'أضحكني',
    labelEn: 'Haha',
    textClass: 'text-amber-500',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-200 dark:border-amber-800/70',
  },
  {
    type: 'wow',
    emoji: '😮',
    labelAr: 'واو',
    labelEn: 'Wow',
    textClass: 'text-sky-500',
    bgClass: 'bg-sky-50 dark:bg-sky-950/50',
    borderClass: 'border-sky-200 dark:border-sky-800/70',
  },
  {
    type: 'fire',
    emoji: '🔥',
    labelAr: 'حماس',
    labelEn: 'Fire',
    textClass: 'text-orange-500',
    bgClass: 'bg-orange-50 dark:bg-orange-950/50',
    borderClass: 'border-orange-200 dark:border-orange-800/70',
  },
  {
    type: 'clap',
    emoji: '👏',
    labelAr: 'رائع',
    labelEn: 'Clap',
    textClass: 'text-emerald-500',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/50',
    borderClass: 'border-emerald-200 dark:border-emerald-800/70',
  },
];

export const REACTION_MAP: Record<ReactionType, ReactionMeta> = REACTIONS.reduce(
  (acc, item) => {
    acc[item.type] = item;
    return acc;
  },
  {} as Record<ReactionType, ReactionMeta>
);

export function isValidReactionType(value: unknown): value is ReactionType {
  return typeof value === 'string' && value in REACTION_MAP;
}

export function normalizeReaction(value: unknown, fallback: ReactionType = 'heart'): ReactionType {
  return isValidReactionType(value) ? value : fallback;
}

export function getTopReactionEntries(
  reactionCounts?: Record<string, number> | null,
  totalLikesFallback = 0,
  limit = 3
): { meta: ReactionMeta; count: number }[] {
  if (reactionCounts && typeof reactionCounts === 'object') {
    const entries = Object.entries(reactionCounts)
      .filter(([key, count]) => isValidReactionType(key) && typeof count === 'number' && count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({
        meta: REACTION_MAP[key as ReactionType],
        count,
      }));
    if (entries.length > 0) return entries;
  }

  if (totalLikesFallback > 0) {
    return [{ meta: REACTION_MAP.heart, count: totalLikesFallback }];
  }

  return [];
}
