import type { Metadata } from 'next';
import { Shell } from '@/components/layout/Shell';
import { Heading } from '@/components/ui/Heading';
import { PokedexList } from '@/components/pokedex/PokedexList';

export const metadata: Metadata = {
  title: 'Pokédex',
  description: 'Browse every National Dex Pokémon: search by name, filter by generation and type, compare base stats.',
};

export default function PokedexPage() {
  return (
    <Shell width="wide" className="space-y-6">
      <Heading level={1} kicker="National Dex" size="lg">
        Pokédex
      </Heading>
      <p className="max-w-2xl text-sm text-muted">
        All 1,025 Pokémon from Generations 1–9 with their alternate forms, base stats, abilities, evolutions and complete
        learnsets, straight from the Pokémon Showdown data that powers every battle here.
      </p>
      <PokedexList />
    </Shell>
  );
}
