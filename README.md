# Pokémon Champions

A browser Pokémon battle game. You get six random Pokémon from Generations 1–9 and face iconic trainers
(Red, Cynthia, Steven, Leon, N, …). Every battle is resolved by the real Pokémon Showdown engine
(`@pkmn/sim`) running entirely in your browser, drawn in a DS-era battle UI with Showdown's Gen 5 animated sprites.

## Modes

| Route | Mode |
| --- | --- |
| `/daily` | **Daily Challenge** — one deterministic team and opponent per UTC day, one official attempt, streaks and a shareable result. |
| `/battle` | **Free Battle** — pick a trainer, generate (and reroll) a team, choose a lead, battle. |
| `/boss-rush` | **Boss Rush** — all 23 trainers in ascending difficulty; optionally keep one team for the whole run. |
| `/custom` | **Custom Battle** — every setting exposed: opponent, generations, level, mode, legendaries, AI difficulty, format. |
| `/trainers` | Trainer roster with full team sets, dialogue and your record against each. |
| `/pokedex` | National Pokédex (1,025 species + forms) with stats, abilities, evolutions and learnsets. |
| `/stats` | Battle history, win rate, streaks, trainers defeated. |
| `/settings` | Player name, battle speed, default AI difficulty, default team settings, reduced motion. |

`/dev/battle` is a developer test bench for the battle screen; it is intentionally not linked from the navigation.

## Setup

Requirements: Node 20+ (Node 25 is used in development) and npm.

```bash
npm install
npm run dev        # http://localhost:3000
```

The app has no backend. All progress (stats, settings, daily records, the in-progress battle for refresh-resume)
is stored in `localStorage`. Sprites, trainer portraits and battle backgrounds are loaded from the
Pokémon Showdown CDN; Pokédex flavor text comes from PokéAPI (cached in `localStorage` for 7 days).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server (Turbopack). Next 16 allows one dev server per checkout. |
| `npm run build` / `npm start` | Production build and server. |
| `npm run typecheck` | `tsc --noEmit` over the whole project (including `scripts/`). |
| `npm run lint` | ESLint (`eslint-config-next`, React Compiler rules). |
| `npm test` | Vitest: unit tests under `src/**/*.test.ts` and the cross-module suite in `tests/integration.test.ts`. |
| `npm run validate:trainers [-- id…]` | Checks every trainer set against the Gen 9 dex and learnsets. |
| `npm run check` | typecheck + lint + test + validate:trainers. |

Standalone TypeScript scripts run with `npx tsx file.mts`.

## Deploy

The project is a standard Next.js 16 App Router app with no server-side state, so it deploys anywhere Next.js runs
(Vercel, Netlify, a Node host running `npm run build && npm start`). No environment variables are required.
`next.config.ts` allow-lists `play.pokemonshowdown.com` and `raw.githubusercontent.com` for remote images.

## Architecture

The full module contract is in [`ARCHITECTURE.md`](./ARCHITECTURE.md). In short:

```
src/app          Next.js routes (thin pages; metadata + a client component in <Suspense>)
src/components   layout/ ui/ battle/ team/ modes/ trainers/ pokedex/ stats/ settings/ home/
src/lib
  battle/        Session wrapper around @pkmn/sim: createBattleSession / restoreBattleSession,
                 protocol → BattleEvent parsing (@pkmn/protocol + @pkmn/view text), snapshots, legal choices
  ai/            Opponent AI (normal / hard / champion) scored with @smogon/calc damage estimates
  teams/         Deterministic random team generation (@pkmn/randoms sets + learnset fallback + EV spreads)
  game/          Mode logic: daily rotation, boss rush runs, trainer → sets, results → stats, share text
  storage/       SSR-safe localStorage accessors (pc:stats, pc:settings, pc:daily:<date>, pc:battle:<saveKey>, pc:bossrush)
  assets/        Asset-provider abstraction (default: Showdown CDN, gen5ani sprites)
  data/          Shared dex instance, Pokédex index, type colours, PokéAPI cache
src/data/trainers  One file per trainer (23) + arenas; validated by scripts/validate-trainers.mts
tests/           Cross-module integration tests
```

Key design points:

* **The engine is the source of truth.** The UI animates the `BattleEvent[]` produced by each turn, then snaps to the
  authoritative `BattleSnapshot` read from the sim before showing the next menu.
* **Battles are saved as input logs.** Refreshing mid-battle replays the seed + teams + every choice through the engine,
  which is deterministic, so the restored battle is identical.
* **Everything is seeded.** Team generation, the battle RNG and the AI's noise all derive from string seeds via the sim's
  `PRNG`, which is what makes the Daily Challenge identical for every player.
* **Heavy libraries load lazily.** `@pkmn/sim`, `@pkmn/randoms` and `@pkmn/dex` are dynamically imported inside
  functions, so the landing page stays light and all of `src/lib` runs in both Node (tests) and the browser.

## Credits and disclaimer

Battle engine, sprites and data: [Pokémon Showdown](https://pokemonshowdown.com) and the `@pkmn` libraries.
Damage calculation: `@smogon/calc`. Species flavor text: [PokéAPI](https://pokeapi.co).

Pokémon and all related names are trademarks of Nintendo, Creatures Inc. and GAME FREAK Inc. This is a non-commercial
fan project and is not affiliated with or endorsed by them.
