'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { PokeBall } from '@/components/ui/PokeBall';
import { cn } from '@/components/ui/cn';
import { MobileDrawer } from './MobileDrawer';
import { NAV_LINKS, isActiveLink } from './navLinks';

/**
 * Sticky top navigation: logo, primary links (desktop) and a hamburger that opens
 * the mobile drawer. The active link is derived from `usePathname`.
 */
export function Nav() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
      <a href="#main" className="sr-only-focusable btn btn-primary btn-sm absolute left-2 top-2 z-50">
        Skip to content
      </a>
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5 rounded" aria-label="Pokémon Champions home">
          <PokeBall size={30} className="transition-transform duration-300 group-hover:rotate-[360deg]" />
          <span className="font-display text-[0.6rem] uppercase leading-none text-text sm:text-xs">
            Pokémon <span className="text-yellow">Champions</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative block rounded px-3 py-2 text-sm font-extrabold transition-colors',
                    active ? 'text-yellow' : 'text-muted hover:text-text',
                    'after:absolute after:inset-x-3 after:-bottom-[0.95rem] after:h-[3px] after:rounded-full after:bg-yellow after:transition-opacity',
                    active ? 'after:opacity-100' : 'after:opacity-0',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/daily" className="btn btn-primary btn-sm hidden sm:inline-flex">
            Daily
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-drawer"
            onClick={() => setOpen(true)}
            className="flex size-10 flex-col items-center justify-center gap-1.5 rounded-ds border-2 border-border bg-surface-2"
          >
            <span className="block h-0.5 w-5 bg-text" />
            <span className="block h-0.5 w-5 bg-text" />
            <span className="block h-0.5 w-5 bg-text" />
          </button>
        </div>
      </nav>
      <MobileDrawer open={open} onClose={() => setOpen(false)} pathname={pathname} />
    </header>
  );
}
