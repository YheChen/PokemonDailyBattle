import Link from 'next/link';
import { cn } from '@/components/ui/cn';

interface Feature {
  href: string;
  title: string;
  text: string;
  accent: string;
  icon: React.ReactNode;
}

const FEATURES: Feature[] = [
  {
    href: '/daily',
    title: 'Daily Challenge',
    text: 'One trainer, one random team, one attempt per day. The same seed for everyone, so compare your result with friends.',
    accent: 'var(--color-accent)',
    icon: <CalendarIcon />,
  },
  {
    href: '/battle',
    title: 'Free Battle',
    text: 'Pick any Champion or legend, reroll your six until you like them, choose a lead and fight at your own pace.',
    accent: 'var(--color-blue)',
    icon: <SwordsIcon />,
  },
  {
    href: '/boss-rush',
    title: 'Boss Rush',
    text: 'Face every trainer back to back, easiest to hardest. Keep your team between fights and see how far you get.',
    accent: 'var(--color-yellow)',
    icon: <TrophyIcon />,
  },
  {
    href: '/custom',
    title: 'Custom',
    text: 'Dial in generations, level, legendaries, AI difficulty and format for a battle built exactly the way you want.',
    accent: 'var(--color-green)',
    icon: <SlidersIcon />,
  },
];

/** The four game-mode blurbs shown on the landing page. */
export function FeatureBlurbs({ className }: { className?: string }) {
  return (
    <ul className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {FEATURES.map((f) => (
        <li key={f.href} className="flex">
          <Link
            href={f.href}
            className="ds-panel group flex w-full flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5"
            style={{ ['--accent' as string]: f.accent }}
          >
            <span
              className="flex size-11 items-center justify-center rounded-ds border-2 border-border bg-bg text-[var(--accent)] transition-transform group-hover:scale-110"
              aria-hidden
            >
              {f.icon}
            </span>
            <h3 className="font-display text-[0.65rem] uppercase leading-relaxed text-text sm:text-xs">{f.title}</h3>
            <p className="text-sm text-muted">{f.text}</p>
            <span className="mt-auto text-xs font-extrabold uppercase tracking-wider text-[var(--accent)]">Play →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  );
}
function SwordsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6M16 16l4 4M19 21l2-2" />
      <path d="M9.5 17.5L21 6V3h-3L6.5 14.5" />
      <path d="M11 19l-6-6M8 16l-4 4M5 21l-2-2" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4a2 2 0 0 0 0 4h3M17 6h3a2 2 0 0 1 0 4h-3" />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h6M14 18h6" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="12" cy="18" r="2" />
    </svg>
  );
}
