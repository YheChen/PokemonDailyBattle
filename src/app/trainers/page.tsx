import type { Metadata } from 'next';
import { Shell } from '@/components/layout/Shell';
import { Heading } from '@/components/ui/Heading';
import { TrainerBrowser } from '@/components/trainers/TrainerBrowser';
import { TRAINERS } from '@/data/trainers';

export const metadata: Metadata = {
  title: 'Trainers',
  description: 'Every Champion and famous trainer you can challenge in Pokémon Champions, with their canonical teams.',
};

export default function TrainersPage() {
  return (
    <Shell width="wide" className="space-y-8">
      <Heading level={1} kicker={`${TRAINERS.length} challengers`} size="lg">
        Trainers
      </Heading>
      <p className="max-w-2xl text-muted">
        Champions from every region and the most famous rivals, bosses and professors of the series. Each one fights with
        a full competitive version of their in-game team. Pick a trainer to see their Pokémon and your record against them.
      </p>
      <TrainerBrowser />
    </Shell>
  );
}
