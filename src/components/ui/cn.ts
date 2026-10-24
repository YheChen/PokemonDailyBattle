/** Accepted inputs for {@link cn}. */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

/**
 * Tiny clsx-like helper: joins truthy class names, flattens arrays and
 * includes object keys whose value is truthy. No dependencies.
 *
 * @example cn('btn', isActive && 'btn-primary', { 'opacity-50': disabled }, ['a', 'b'])
 */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string' || typeof input === 'number') {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) out.push(inner);
    } else if (typeof input === 'object') {
      for (const key of Object.keys(input)) {
        if (input[key]) out.push(key);
      }
    }
  }
  return out.join(' ');
}
