import type { Metadata } from 'next';
import { Shell } from '@/components/layout/Shell';
import { PokedexDetail } from '@/components/pokedex/PokedexDetail';

interface Params {
  params: Promise<{ id: string }>;
}

function titleFromId(id: string): string {
  const clean = decodeURIComponent(id).replace(/[^a-z0-9]/gi, '');
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Pokémon';
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `${titleFromId(id)} · Pokédex`,
    description: `Pokédex entry: base stats, abilities, forms, evolutions and learnset.`,
  };
}

export default async function PokedexEntryPage({ params }: Params) {
  const { id } = await params;
  return (
    <Shell width="default">
      <PokedexDetail key={id} id={decodeURIComponent(id)} />
    </Shell>
  );
}
