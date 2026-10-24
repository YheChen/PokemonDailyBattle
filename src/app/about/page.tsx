import type { Metadata } from 'next';
import { Shell } from '@/components/layout/Shell';
import { Heading } from '@/components/ui/Heading';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { assets } from '@/lib/assets/provider';

export const metadata: Metadata = {
  title: 'About',
  description: 'Credits, attribution and disclaimer for Pokémon Champions, a fan-made browser battle game.',
};

const ENGINE_CREDITS = [
  { name: 'Pokémon Showdown', url: 'https://pokemonshowdown.com', note: 'The battle simulator whose engine resolves every battle here.' },
  { name: '@pkmn (pkmn/ps)', url: 'https://github.com/pkmn/ps', note: 'Modular, MIT-licensed builds of the Showdown simulator, data, random-battle sets, protocol parser and sprite helpers.' },
  { name: '@smogon/calc', url: 'https://github.com/smogon/damage-calc', note: 'The Smogon damage calculator used by the opponent AI to evaluate moves.' },
  { name: 'Next.js, React and Tailwind CSS', url: 'https://nextjs.org', note: 'The web framework and styling toolkit.' },
];

export default function AboutPage() {
  return (
    <Shell width="narrow" className="space-y-8">
      <Heading level={1} kicker="About" size="lg">
        Pokémon Champions
      </Heading>
      <p className="text-muted">
        Pokémon Champions is a free, fan-made browser game. Every day you get six random Pokémon from across all nine
        generations and one shot at beating a legendary trainer. Battles run entirely in your browser on the real
        Pokémon Showdown engine, so every interaction is exactly as it is in competitive play.
      </p>

      <Panel title="Disclaimer">
        <p className="text-sm">
          This is an unofficial fan project. It is <strong>not affiliated with, endorsed by or connected to</strong>{' '}
          Nintendo, Game Freak, Creatures Inc. or The Pokémon Company. Pokémon, Pokémon character names and all related
          marks are trademarks of their respective owners. No money is made from this project.
        </p>
      </Panel>

      <Panel title="Battle engine">
        <ul className="space-y-3 text-sm">
          {ENGINE_CREDITS.map((c) => (
            <li key={c.url}>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-extrabold text-blue underline-offset-2 hover:underline">
                {c.name}
              </a>
              <span className="text-muted"> — {c.note}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Sprites & data">
        <ul className="space-y-3 text-sm">
          {assets.attribution.map((a) => (
            <li key={a.url}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-extrabold text-blue underline-offset-2 hover:underline">
                {a.name}
              </a>
              <span className="text-muted"> — {a.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Current asset provider: {assets.name}.</p>
      </Panel>

      <Panel title="How it works">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Teams are generated from Showdown&apos;s own random-battle set tables, with competitive EV spreads and natures.</li>
          <li>The Daily Challenge seed is derived from the UTC date, so everyone fights the same trainer with the same team.</li>
          <li>Opponent AI estimates damage with the Smogon calculator and picks moves, switches and Mega Evolutions accordingly.</li>
          <li>Your stats, settings and in-progress battle are stored only in your browser (localStorage). Nothing is uploaded.</li>
        </ul>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Button href="/daily" variant="primary">
          Play today&apos;s challenge
        </Button>
        <Button href="/" variant="ghost">
          Back home
        </Button>
      </div>
    </Shell>
  );
}
