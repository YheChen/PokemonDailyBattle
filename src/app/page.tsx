import { Shell } from '@/components/layout/Shell';
import { FeatureBlurbs } from '@/components/home/FeatureBlurbs';
import { Hero } from '@/components/home/Hero';
import { StatsStrip } from '@/components/home/StatsStrip';
import { TodaysChallenger } from '@/components/home/TodaysChallenger';
import { TrainerGrid } from '@/components/trainers/TrainerGrid';
import { Heading } from '@/components/ui/Heading';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <Shell width="wide" className="space-y-12 sm:space-y-16">
      <Hero />

      <div className="space-y-6">
        <TodaysChallenger />
        <StatsStrip />
      </div>

      <section aria-labelledby="modes-heading" className="space-y-6">
        <Heading level={2} id="modes-heading" kicker="Ways to play" align="center">
          Choose your challenge
        </Heading>
        <FeatureBlurbs />
      </section>

      <section aria-labelledby="trainers-heading" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Heading level={2} id="trainers-heading" kicker="23 legendary opponents">
            The Champions
          </Heading>
          <Button href="/trainers" variant="ghost" size="sm">
            View all trainers →
          </Button>
        </div>
        <TrainerGrid />
      </section>

      <p className="text-center text-sm text-muted">
        Battles are resolved by the open-source{' '}
        <a
          href="https://github.com/pkmn/ps"
          className="font-bold text-blue underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pokémon Showdown engine
        </a>
        . Every move, ability and item behaves exactly as it does in competitive play.
      </p>
    </Shell>
  );
}
