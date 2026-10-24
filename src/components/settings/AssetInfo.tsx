import { assets } from '@/lib/assets/provider';
import { Badge } from '@/components/ui/Badge';

/** Which asset provider is active plus its attribution list. */
export function AssetInfo() {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-extrabold uppercase tracking-wide text-muted">Active provider</span>
        <Badge tone="blue">{assets.name}</Badge>
      </div>
      <p className="text-xs text-muted">
        Sprites, portraits and arena backgrounds are loaded from the provider below. Custom asset packs are not available yet;
        the provider abstraction is in place so they can be added without touching the game.
      </p>
      <ul className="space-y-3">
        {assets.attribution.map((a) => (
          <li key={a.url}>
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-extrabold text-blue underline-offset-2 hover:underline">
              {a.name}
            </a>
            <span className="text-muted"> — {a.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
