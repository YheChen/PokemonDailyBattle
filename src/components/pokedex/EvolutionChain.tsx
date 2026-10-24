import Link from 'next/link';
import type { ReactNode } from 'react';
import { PokemonSprite } from '@/components/ui/PokemonSprite';
import { cn } from '@/components/ui/cn';
import type { EvoTree } from '@/lib/data/pokedex';

export interface EvolutionChainProps {
  /** Family tree from the root pre-evolution. */
  root: EvoTree;
  /** Id of the species being viewed (highlighted). */
  currentId: string;
}

function EvoLink({ node, current }: { node: EvoTree; current: boolean }) {
  return (
    <Link
      href={`/pokedex/${node.id}`}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex w-28 flex-col items-center gap-1 rounded-ds border-2 p-2 text-center transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-yellow',
        current ? 'border-yellow bg-surface-2' : 'border-border bg-bg/40 hover:border-border-light',
      )}
    >
      <PokemonSprite species={node.name} variant="menu" size={64} />
      <span className="w-full truncate text-xs font-extrabold">{node.name}</span>
      <span className="font-pixel text-sm leading-none text-muted">#{node.num}</span>
    </Link>
  );
}

function Arrow({ method }: { method?: string }) {
  return (
    <div className="flex items-center gap-1 self-center text-muted sm:flex-col" aria-hidden={!method}>
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 rotate-90 sm:rotate-0" aria-hidden>
        <path d="M4 12h14m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {method ? <span className="max-w-32 text-center text-[0.65rem] font-bold leading-tight">{method}</span> : null}
    </div>
  );
}

function Branch({ node, currentId }: { node: EvoTree; currentId: string }): ReactNode {
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
      <EvoLink node={node} current={node.id === currentId} />
      {node.evos.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {node.evos.length === 1 ? (
            <>
              <Arrow method={node.evos[0].method} />
              <Branch node={node.evos[0]} currentId={currentId} />
            </>
          ) : (
            <div className="flex flex-col gap-3">
              {node.evos.map((e) => (
                <div key={e.id} className="flex flex-col items-center gap-2 sm:flex-row">
                  <Arrow method={e.method} />
                  <Branch node={e} currentId={currentId} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Evolution family rendered left-to-right (top-to-bottom on phones) with links to each stage. */
export function EvolutionChain({ root, currentId }: EvolutionChainProps) {
  if (root.evos.length === 0) {
    return <p className="text-sm text-muted">This Pokémon does not evolve.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Branch node={root} currentId={currentId} />
    </div>
  );
}
