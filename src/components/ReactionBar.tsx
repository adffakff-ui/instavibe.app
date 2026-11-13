import React, { useEffect, useRef, useState } from 'react';
import { Heart, SmilePlus } from 'lucide-react';
import {
  REACTIONS,
  REACTION_MAP,
  ReactionType,
  getTopReactionEntries,
} from '../utils/reactions';

export interface BurstInstance {
  id: number;
  emoji: string;
  x?: number;
  y?: number;
}

export function TapBurstOverlay({ bursts }: { bursts: BurstInstance[] }) {
  if (bursts.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {bursts.map((burst) => {
        const hasCoords = typeof burst.x === 'number' && typeof burst.y === 'number';
        const style: React.CSSProperties = hasCoords
          ? { left: `${burst.x}%`, top: `${burst.y}%` }
          : { left: '50%', top: '50%' };

        return (
          <div
            key={burst.id}
            style={style}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          >
            <div className="w-24 h-24 rounded-full border-2 border-white/75 animate-heart-ring" />
            <span
              className="absolute text-6xl sm:text-7xl drop-shadow-[0_6px_22px_rgba(0,0,0,0.45)] animate-tap-burst select-none"
              aria-hidden="true"
            >
              {burst.emoji}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ReactionControlProps {
  activeReaction: ReactionType | null;
  likesCount: number;
  reactionCounts?: Record<string, number> | null;
  language: 'en' | 'ar';
  onToggleLike: () => void;
  onSelectReaction: (reaction: ReactionType) => void;
  variant?: 'post' | 'reel';
}

export function ReactionControl({
  activeReaction,
  likesCount,
  reactionCounts,
  language,
  onToggleLike,
  onSelectReaction,
  variant = 'post',
}: ReactionControlProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen]);

  const triggerPop = () => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 360);
  };

  const handlePrimaryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeReaction) triggerPop();
    onToggleLike();
  };

  const handlePick = (e: React.MouseEvent, type: ReactionType) => {
    e.stopPropagation();
    triggerPop();
    onSelectReaction(type);
    setPickerOpen(false);
  };

  const activeMeta = activeReaction ? REACTION_MAP[activeReaction] : null;
  const isCustomEmoji = activeReaction && activeReaction !== 'heart';

  if (variant === 'reel') {
    const topEntries = getTopReactionEntries(reactionCounts, likesCount, 2);
    return (
      <div ref={containerRef} className="relative flex flex-col items-center gap-2">
        {pickerOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-full mb-2 end-0 flex items-center gap-1 p-1.5 rounded-full bg-slate-900/90 backdrop-blur-xl border border-white/20 shadow-2xl z-40"
          >
            {REACTIONS.map((item) => {
              const isSelected = activeReaction === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={(e) => handlePick(e, item.type)}
                  aria-label={language === 'ar' ? item.labelAr : item.labelEn}
                  title={language === 'ar' ? item.labelAr : item.labelEn}
                  className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-xl transition-transform active:scale-90 ${
                    isSelected
                      ? 'bg-white/25 scale-110 ring-1 ring-white/50'
                      : 'hover:bg-white/15 hover:scale-125'
                  }`}
                >
                  {item.emoji}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handlePrimaryClick}
          className="flex flex-col items-center gap-1 min-w-[44px]"
          aria-label={language === 'ar' ? 'إعجاب' : 'Like'}
          aria-pressed={Boolean(activeReaction)}
        >
          <div className="w-11 h-11 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md flex items-center justify-center border border-white/10 active:scale-90 transition-transform">
            {isCustomEmoji && activeMeta ? (
              <span
                className={`text-2xl leading-none ${animating ? 'animate-emoji-tap' : ''}`}
                aria-hidden="true"
              >
                {activeMeta.emoji}
              </span>
            ) : (
              <Heart
                size={22}
                className={`${animating ? 'animate-heart-pop' : ''} ${
                  activeReaction ? 'text-rose-500 fill-rose-500' : 'text-white'
                }`}
              />
            )}
          </div>
          <div className="flex items-center gap-1">
            {topEntries.length > 0 && (
              <span className="text-[11px] leading-none flex items-center -space-x-0.5">
                {topEntries.map((entry) => (
                  <span key={entry.meta.type}>{entry.meta.emoji}</span>
                ))}
              </span>
            )}
            <span className="text-[11px] font-bold tabular-nums drop-shadow text-white">
              {likesCount}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((prev) => !prev);
          }}
          aria-label={language === 'ar' ? 'اختر تفاعلاً' : 'Choose reaction'}
          aria-expanded={pickerOpen}
          title={language === 'ar' ? 'تفاعلات سريعة' : 'Quick reactions'}
          className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center border transition-all active:scale-90 ${
            pickerOpen
              ? 'bg-white text-slate-900 border-white'
              : 'bg-black/45 hover:bg-black/65 text-white/90 border-white/15'
          }`}
        >
          <SmilePlus size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      {pickerOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full mb-2 start-0 flex items-center gap-1 p-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-xl z-40"
        >
          {REACTIONS.map((item) => {
            const isSelected = activeReaction === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={(e) => handlePick(e, item.type)}
                aria-label={language === 'ar' ? item.labelAr : item.labelEn}
                title={language === 'ar' ? item.labelAr : item.labelEn}
                className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-xl transition-transform active:scale-90 ${
                  isSelected
                    ? `${item.bgClass} scale-110 ring-1 ${item.borderClass}`
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-125'
                }`}
              >
                {item.emoji}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={handlePrimaryClick}
        className={`min-h-[40px] px-2 flex items-center gap-1.5 rounded-full transition-colors active:scale-90 ${
          activeMeta
            ? activeMeta.textClass
            : 'hover:text-slate-500 text-slate-700 dark:text-slate-300'
        }`}
        aria-label={
          activeMeta
            ? `${language === 'ar' ? activeMeta.labelAr : activeMeta.labelEn}`
            : language === 'ar'
            ? 'إعجاب'
            : 'Like post'
        }
        aria-pressed={Boolean(activeReaction)}
      >
        {isCustomEmoji && activeMeta ? (
          <span
            className={`text-[22px] leading-none ${animating ? 'animate-emoji-tap' : ''}`}
            aria-hidden="true"
          >
            {activeMeta.emoji}
          </span>
        ) : (
          <Heart
            size={24}
            className={`${animating ? 'animate-heart-pop' : ''} ${
              activeReaction ? 'text-rose-500 fill-rose-500' : ''
            }`}
          />
        )}
        {activeMeta && (
          <span className="text-xs font-bold">
            {language === 'ar' ? activeMeta.labelAr : activeMeta.labelEn}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPickerOpen((prev) => !prev);
        }}
        aria-label={language === 'ar' ? 'اختر تفاعلاً' : 'Pick a reaction'}
        aria-expanded={pickerOpen}
        title={language === 'ar' ? 'تفاعل برمز تعبيري' : 'React with emoji'}
        className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full transition-colors active:scale-90 ${
          pickerOpen
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
        }`}
      >
        <SmilePlus size={20} />
      </button>
    </div>
  );
}

export function ReactionSummaryRow({
  likesCount,
  reactionCounts,
  likesLabel,
  language,
}: {
  likesCount: number;
  reactionCounts?: Record<string, number> | null;
  likesLabel: string;
  language: 'en' | 'ar';
}) {
  const [expanded, setExpanded] = useState(false);
  const entries = getTopReactionEntries(reactionCounts, likesCount, 6);
  const topThree = entries.slice(0, 3);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {topThree.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 group focus:outline-none"
            aria-expanded={expanded}
            title={language === 'ar' ? 'عرض تفاصيل التفاعلات' : 'View reaction breakdown'}
          >
            <span className="inline-flex items-center -space-x-1 rtl:space-x-reverse">
              {topThree.map((entry) => (
                <span
                  key={entry.meta.type}
                  className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-white dark:border-slate-900 flex items-center justify-center text-xs shadow-xs"
                >
                  {entry.meta.emoji}
                </span>
              ))}
            </span>
            <span className="font-bold text-sm text-slate-900 dark:text-white tabular-nums group-hover:underline">
              {likesCount} {likesLabel}
            </span>
          </button>
        )}

        {topThree.length === 0 && (
          <span className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">
            {likesCount} {likesLabel}
          </span>
        )}
      </div>

      {expanded && entries.length > 0 && (
        <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
          {entries.map((entry) => (
            <span
              key={entry.meta.type}
              className="inline-flex items-center gap-1 font-medium tabular-nums"
            >
              <span>{entry.meta.emoji}</span>
              <span>{entry.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
