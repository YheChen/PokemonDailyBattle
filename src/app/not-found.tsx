import { Shell } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import { PokeBall } from '@/components/ui/PokeBall';

export default function NotFound() {
  return (
    <Shell width="narrow" className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="ds-panel-light w-full max-w-lg px-6 py-10">
        <PokeBall size={72} className="mx-auto animate-float opacity-80 grayscale" />
        <p className="mt-6 font-display text-3xl text-yellow">404</p>
        <h1 className="mt-3 font-display text-xs uppercase leading-relaxed sm:text-sm">Wild page not found</h1>
        <p className="mt-3 font-pixel text-2xl leading-tight text-muted">
          The page fled! There&apos;s nothing here but tall grass.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button href="/" variant="primary">
            Back home
          </Button>
          <Button href="/daily" variant="ghost">
            Today&apos;s challenge
          </Button>
        </div>
      </div>
    </Shell>
  );
}
