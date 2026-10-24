import type { FieldView } from '@/lib/battle/types';
import { PSEUDO_WEATHER_LABELS, TERRAIN_LABELS, WEATHER_LABELS } from './displayState';

export interface FieldIndicatorsProps {
  field: FieldView;
  turn: number;
}

/** Weather / terrain / room chips at the top center of the viewport plus the turn counter. */
export function FieldIndicators({ field, turn }: FieldIndicatorsProps) {
  const chips: string[] = [];
  if (field.weather) chips.push(WEATHER_LABELS[field.weather] ?? field.weather);
  if (field.terrain) chips.push(TERRAIN_LABELS[field.terrain] ?? field.terrain);
  // Only real field effects (rules such as Sleep Clause Mod also live in pseudoWeather).
  for (const pw of field.pseudoWeather) if (PSEUDO_WEATHER_LABELS[pw]) chips.push(PSEUDO_WEATHER_LABELS[pw]);
  return (
    <>
      {chips.length ? (
        <div className="bv-field" aria-label="Field conditions">
          {chips.map((c) => (
            <span key={c} className="bv-field-chip">
              {c}
            </span>
          ))}
        </div>
      ) : null}
      {turn > 0 ? (
        <div className="bv-turn" aria-label={`Turn ${turn}`}>
          TURN {turn}
        </div>
      ) : null}
    </>
  );
}
