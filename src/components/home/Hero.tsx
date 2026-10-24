import { Button } from '@/components/ui/Button';
import { PokeBall } from '@/components/ui/PokeBall';

export const HERO_TITLE = 'Pokémon Champions';
export const HERO_SUBTITLE = 'Six random Pokémon. Legendary opponents. One chance to become Champion.';

/** Landing hero: title, subtitle and the three primary calls to action. */
export function Hero() {
  return (
    <section className="relative overflow-hidden py-8 text-center sm:py-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-[0.07]">
        <PokeBall size={520} className="animate-float" />
      </div>
      <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.3em] text-yellow animate-fade-up">A daily battle challenge</p>
      <h1 className="font-display text-xl uppercase leading-[1.7] text-text animate-fade-up sm:text-3xl md:text-4xl md:leading-[1.6] [animation-delay:60ms]">
        Pokémon <span className="text-yellow drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">Champions</span>
      </h1>
      <p className="mx-auto mt-5 max-w-2xl font-pixel text-2xl leading-tight text-muted animate-fade-up sm:text-3xl [animation-delay:120ms]">
        {HERO_SUBTITLE}
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 animate-fade-up sm:flex-row [animation-delay:180ms]">
        <Button href="/daily" variant="primary" size="xl" className="w-full sm:w-auto">
          Start daily battle
        </Button>
        <Button href="/battle" variant="secondary" size="lg" className="w-full sm:w-auto">
          Free Battle
        </Button>
        <Button href="/boss-rush" variant="ghost" size="lg" className="w-full sm:w-auto">
          Boss Rush
        </Button>
      </div>
    </section>
  );
}
