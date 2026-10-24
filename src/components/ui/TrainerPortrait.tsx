'use client';
import { useState } from 'react';
import { assets } from '@/lib/assets/provider';
import { cn } from './cn';

export interface TrainerPortraitProps {
  /** Avatar id for the asset provider (e.g. `'cynthia'`, `'red-masters'`). */
  avatar: string;
  /** Trainer name (alt text / fallback initial). */
  name: string;
  /** Rendered pixel size (square). Default 80. */
  size?: number;
  /** Framed in a DS panel with a rounded border. Default true. */
  framed?: boolean;
  className?: string;
}

/**
 * Trainer portrait from the asset provider with a silhouette fallback when the image fails.
 */
export function TrainerPortrait({ avatar, name, size = 80, framed = true, className }: TrainerPortraitProps) {
  const src = assets.trainerPortrait(avatar);
  // Remember which src failed so a new avatar retries the image (derived-state pattern, no effect needed).
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-end justify-center overflow-hidden',
        framed && 'rounded-ds border-2 border-border bg-surface-2 shadow-[inset_2px_2px_0_rgba(255,255,255,0.12),inset_-2px_-2px_0_rgba(0,0,0,0.3)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <Silhouette name={name} size={size} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="sprite h-full w-full object-contain object-bottom"
        />
      )}
    </span>
  );
}

function Silhouette({ name, size }: { name: string; size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={name} className="text-border-light">
      <circle cx="32" cy="22" r="12" fill="currentColor" />
      <path d="M10 62c0-14 10-22 22-22s22 8 22 22z" fill="currentColor" />
      <text x="32" y="60" textAnchor="middle" fontSize="10" fontWeight="800" fill="#0f1226" fontFamily="sans-serif">
        {name.slice(0, 1).toUpperCase()}
      </text>
    </svg>
  );
}
