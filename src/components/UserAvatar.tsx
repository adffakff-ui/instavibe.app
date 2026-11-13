import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GRADIENT_PALETTES = [
  'from-purple-500 to-rose-500',
  'from-indigo-500 to-cyan-500',
  'from-rose-500 to-amber-500',
  'from-emerald-500 to-teal-500',
  'from-violet-600 to-fuchsia-500',
];

function getPaletteForName(name?: string): string {
  const key = (name || '').trim();
  if (!key) return GRADIENT_PALETTES[0];
  let sum = 0;
  for (let i = 0; i < key.length; i += 1) {
    sum += key.charCodeAt(i);
  }
  return GRADIENT_PALETTES[sum % GRADIENT_PALETTES.length];
}

export interface UserAvatarProps {
  src?: string | null;
  username?: string | null;
  alt?: string;
  className?: string;
  iconSize?: number;
}

export default function UserAvatar({
  src,
  username,
  alt,
  className,
  iconSize = 16,
}: UserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const normalizedSrc =
    typeof src === 'string' && src.trim() !== '' && src.trim() !== '/placeholder-avatar.jpg'
      ? src.trim()
      : '';

  useEffect(() => {
    setImgFailed(false);
  }, [normalizedSrc]);

  if (normalizedSrc && !imgFailed) {
    return (
      <img
        src={normalizedSrc}
        alt={alt || username || 'User'}
        className={cn('w-full h-full object-cover', className)}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
      />
    );
  }

  const cleanLabel = (username || alt || '').replace(/^@/, '').trim();
  const initial = cleanLabel ? cleanLabel[0].toUpperCase() : '';
  const gradient = getPaletteForName(cleanLabel);

  return (
    <div
      aria-label={alt || username || 'User avatar'}
      className={cn(
        'w-full h-full flex items-center justify-center bg-gradient-to-br text-white font-bold select-none',
        gradient,
        className
      )}
    >
      {initial ? (
        <span className="leading-none text-[0.7em]">{initial}</span>
      ) : (
        <User size={iconSize} className="text-white/90" />
      )}
    </div>
  );
}
