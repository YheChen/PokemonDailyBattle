import type { Metadata } from 'next';
import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import { PokeBall } from '@/components/ui/PokeBall';
import { TrainerDetail } from '@/components/trainers/TrainerDetail';
import { TRAINERS, getTrainer } from '@/data/trainers';

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return TRAINERS.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const trainer = getTrainer(id);
  if (!trainer) return { title: 'Trainer not found' };
  return {
    title: `${trainer.title} ${trainer.name}`,
    description: `${trainer.subtitle}. ${trainer.bio}`,
  };
}

export default async function TrainerPage({ params }: Props) {
  const { id } = await params;
  const trainer = getTrainer(id);

  if (!trainer) {
    return (
      <Shell width="narrow" className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="ds-panel-light w-full max-w-lg px-6 py-10">
          <PokeBall size={64} className="mx-auto opacity-80 grayscale" />
          <h1 className="mt-6 font-display text-xs uppercase leading-relaxed sm:text-sm">Trainer not found</h1>
          <p className="mt-3 font-pixel text-2xl leading-tight text-muted">
            No trainer goes by &ldquo;{id}&rdquo;. Maybe they&apos;re still on their journey.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/trainers" variant="primary">
              All trainers
            </Button>
            <Button href="/" variant="ghost">
              Back home
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell width="wide">
      <TrainerDetail trainer={trainer} />
    </Shell>
  );
}
