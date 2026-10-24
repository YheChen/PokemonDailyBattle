import Link from 'next/link';
import { PokeBall } from '@/components/ui/PokeBall';
import { assets } from '@/lib/assets/provider';

const LINKS = [
  { href: '/daily', label: 'Daily Challenge' },
  { href: '/battle', label: 'Free Battle' },
  { href: '/boss-rush', label: 'Boss Rush' },
  { href: '/custom', label: 'Custom Battle' },
  { href: '/trainers', label: 'Trainers' },
  { href: '/pokedex', label: 'Pokédex' },
  { href: '/stats', label: 'Stats' },
  { href: '/about', label: 'About & credits' },
];

/** Site footer: links, asset attribution and the fan-project disclaimer. */
export function Footer() {
  const sprites = assets.attribution[0];
  return (
    <footer className="mt-auto border-t-2 border-border bg-bg/60">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <PokeBall size={22} />
            <span className="font-display text-[0.6rem] uppercase">Pokémon Daily Battle</span>
          </div>
          <p className="max-w-md text-sm text-muted">
            A fan-made browser battle game. Six random Pokémon, legendary opponents, one chance to become Champion.
            Battles are resolved by the open-source{' '}
            <a href="https://github.com/pkmn/ps" className="font-bold text-blue underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
              Pokémon Showdown engine
            </a>
            .
          </p>
          <p className="text-xs text-muted">
            Sprites and portraits:{' '}
            <a href={sprites.url} className="underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
              {sprites.name}
            </a>
            . Pokémon and all respective names are trademarks of Nintendo, Game Freak and The Pokémon Company.
          </p>
          <p className="text-xs font-bold text-muted">Not affiliated with Nintendo.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="font-bold text-muted transition-colors hover:text-text">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
