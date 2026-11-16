import React, { useState } from 'react';
import { REACTIONS, ReactionType, getTopReactionEntries } from '../utils/reactions';

export interface EmojiBurstParticle {
  id: string;
  tx: number;
  ty: number;
  rot: number;
  scale: number;
  durationMs: number;
  delayMs: number;
  fontSizePx: number;
}

export interface EmojiBurstEvent {
  id: number;
  emoji: string;
  x: number;
  y: number;
  particles: EmojiBurstParticle[];
}

export function createEmojiBurstEvent(
  emoji: string,
  x: number = 50,
  y: number = 80,
  direction: 'fountain' | 'radial' = 'fountain'
): EmojiBurstEvent {
  const burstId = Date.now() + Math.floor(Math.random() * 10000);
  const particleCount = 12;

  const particles: EmojiBurstParticle[] = Array.from({ length: particleCount }).map((_, idx) => {
    if (direction === 'radial') {
      const baseAngle = (idx / particleCount) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.35;
      const angle = baseAngle + jitter;
      const distance = 68 + Math.random() * 88;
      return {
        id: `${burstId}_${idx}`,
        tx: Math.round(Math.cos(angle) * distance),
        ty: Math.round(Math.sin(angle) * distance - 18),
        rot: Math.round((Math.random() - 0.5) * 64),
        scale: Number((0.75 + Math.random() * 0.65).toFixed(2)),
        durationMs: Math.round(700 + Math.random() * 240),
        delayMs: Math.round((idx % 3) * 28),
        fontSizePx: Math.round(22 + Math.random() * 14),
      };
    }

    // Fountain arc upward from reaction tray
    const spreadRatio = idx / (particleCount - 1) - 0.5;
    const tx = Math.round(spreadRatio * 210 + (Math.random() - 0.5) * 34);
    const ty = Math.round(-(105 + Math.random() * 165));
    return {
      id: `${burstId}_${idx}`,
      tx,
      ty,
      rot: Math.round((Math.random() - 0.5) * 56),
      scale: Number((0.8 + Math.random() * 0.65).toFixed(2)),
      durationMs: Math.round(760 + Math.random() * 260),
      delayMs: Math.round((idx % 4) * 30),
      fontSizePx: Math.round(22 + Math.random() * 16),
    };
  });

  return {
    id: burstId,
    emoji,
    x: Math.min(92, Math.max(8, x)),
    y: Math.min(92, Math.max(12, y)),
    particles,
  };
}

export function EmojiBurstOverlay({ bursts }: { bursts: EmojiBurstEvent[] }) {
  if (bursts.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30" aria-hidden="true">
      {bursts.map((burst) => (
        <div
          key={burst.id}
          style={{ left: `${burst.x}%`, top: `${burst.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
        >
          {/* Shockwave Ring */}
          <div className="w-24 h-24 rounded-full border-2 border-white/80 shadow-[0_0_24px_rgba(255,255,255,0.45)] animate-heart-ring" />

          {/* Central Hero Emoji */}
          <span className="absolute text-5xl sm:text-6xl drop-shadow-[0_8px_22px_rgba(0,0,0,0.55)] animate-tap-burst select-none">
            {burst.emoji}
          </span>

          {/* Radial Confetti Emoji Particles */}
          {burst.particles.map((p) => (
            <span
              key={p.id}
              style={
                {
                  fontSize: `${p.fontSizePx}px`,
                  '--burst-tx': `${p.tx}px`,
                  '--burst-ty': `${p.ty}px`,
                  '--burst-rot': `${p.rot}deg`,
                  '--burst-scale': p.scale,
                  '--burst-dur': `${p.durationMs}ms`,
                  animationDelay: `${p.delayMs}ms`,
                } as React.CSSProperties
              }
              className="absolute left-0 top-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] animate-emoji-burst-particle select-none will-change-transform"
            >
              {burst.emoji}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

interface StoryReactionTrayProps {
  selectedReaction: ReactionType | null;
  reactionCounts?: Record<string, number> | null;
  language: 'en' | 'ar';
  onReact: (reaction: ReactionType, buttonEl: HTMLButtonElement) => void;
}

export function StoryReactionTray({
  selectedReaction,
  reactionCounts,
  language,
  onReact,
}: StoryReactionTrayProps) {
  const [poppingType, setPoppingType] = useState<ReactionType | null>(null);

  const handleTap = (type: ReactionType, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setPoppingType(type);
    setTimeout(() => {
      setPoppingType((curr) => (curr === type ? null : curr));
    }, 340);
    onReact(type, e.currentTarget);
  };

  return (
    <div
      role="group"
      aria-label={language === 'ar' ? 'شريط تفاعلات القصة' : 'Story emoji reaction tray'}
      className="flex items-center justify-between gap-1 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-1 shadow-lg"
    >
      {REACTIONS.map((item) => {
        const isSelected = selectedReaction === item.type;
        const isPopping = poppingType === item.type;
        const count =
          reactionCounts && typeof reactionCounts[item.type] === 'number'
            ? reactionCounts[item.type]
            : 0;

        return (
          <button
            key={item.type}
            type="button"
            onClick={(e) => handleTap(item.type, e)}
            aria-label={language === 'ar' ? item.labelAr : item.labelEn}
            aria-pressed={isSelected}
            title={language === 'ar' ? item.labelAr : item.labelEn}
            className={`relative min-h-[44px] flex-1 flex items-center justify-center gap-1 rounded-xl transition-all duration-150 active:scale-90 ${
              isSelected
                ? 'bg-white/25 ring-1 ring-white/70 shadow-[0_0_16px_rgba(255,255,255,0.25)] scale-[1.03]'
                : 'hover:bg-white/15 hover:scale-105'
            }`}
          >
            <span
              className={`text-xl sm:text-2xl leading-none transition-transform duration-150 ${
                isPopping ? 'animate-emoji-tap scale-125' : ''
              }`}
              aria-hidden="true"
            >
              {item.emoji}
            </span>
            {count > 0 && (
              <span className="text-[10px] font-extrabold text-white tabular-nums drop-shadow-sm">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function StoryReactionSummaryPill({
  reactionCounts,
  totalCount,
  language,
  onClick,
}: {
  reactionCounts?: Record<string, number> | null;
  totalCount: number;
  language: 'en' | 'ar';
  onClick?: () => void;
}) {
  const topEntries = getTopReactionEntries(reactionCounts, totalCount, 3);
  if (totalCount <= 0 || topEntries.length === 0) return null;

  const content = (
    <>
      <span className="inline-flex items-center -space-x-1 rtl:space-x-reverse">
        {topEntries.map((entry) => (
          <span key={entry.meta.type} className="text-sm leading-none drop-shadow-sm">
            {entry.meta.emoji}
          </span>
        ))}
      </span>
      <span className="text-[11px] font-bold text-white tabular-nums">
        {totalCount}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/20 shadow-lg transition-colors"
        title={language === 'ar' ? 'عرض التفاعلات' : 'View reactions'}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 shadow-lg pointer-events-none">
      {content}
    </div>
  );
}
