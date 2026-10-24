# Pokémon Champions — Architecture

A browser-based Pokémon battle game. Six random Pokémon from Gens 1–9 vs iconic trainers.
Battles are resolved by the real Pokémon Showdown engine (`@pkmn/sim`) running in the browser.

This document is the contract every module is built against. Read it fully before writing code.

## Stack (already installed — do not add dependencies without a strong reason)

| Package | Use |
| --- | --- |
| `next@16` (App Router, Turbopack), `react@19`, `tailwindcss@4` | App + UI |
| `@pkmn/sim` | The Pokémon Showdown battle engine (`Battle`, `Teams`, `Dex`, `PRNG`) |
| `@pkmn/randoms` | Showdown's random-battle set generators (`TeamGenerators`) |
| `@pkmn/dex`, `@pkmn/data` | Dex data for UI/Pokédex (`Dex.forGen(9)`, learnsets, species, moves) |
| `@pkmn/protocol` | `Protocol.parseBattleLine(line)` → `{args, kwArgs}` |
| `@pkmn/view` + `@pkmn/client` | `LogFormatter` turns protocol lines into in-game battle text |
| `@pkmn/img` | `Sprites.getPokemon(name, {gen: 'gen5ani', side})`, `Sprites.getAvatar(id)`, `Icons.getPokemon(name)` |
| `@smogon/calc` | Damage calculation for the AI |
| `vitest`, `tsx` | Tests (`npm test`) and scripts |

Scripts: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run validate:trainers`, `npm run check` (all of them).

## Verified facts about the libraries (from probing — trust these)

* Format id for battles: `gen9nationaldex@@@!Team Preview` (constant `DEFAULT_FORMAT` in `src/lib/battle/types.ts`).
  `Dex.formats.get(id, true)` resolves it; custom rules after `@@@` work. The NatDex ruleset includes
  `Terastal Clause` (Terastallization is disabled) and `Sleep Clause Mod`. Megas and Z-moves ARE allowed.
* `new Battle({formatid, seed, send})` — `seed` is a **string** like `"12,345,6789,10"` (four numbers) or
  `PRNG.generateSeed()`. Arrays are not accepted by the types. `send(type, data)` receives
  `('update', string[])` with protocol lines and `('sideupdate', 'p1\n|request|{...}')`.
* `battle.setPlayer('p1', {name, team})` then `battle.setPlayer('p2', {name, team})` — the battle starts as soon as both
  players are set (no Team Preview thanks to the custom rule). `team` may be a `PokemonSet[]` or a packed string.
* `battle.p1.activeRequest` is the typed `ChoiceRequest` (`MoveRequest | SwitchRequest | WaitRequest | TeamPreviewRequest`)
  exported by `@pkmn/sim`. `battle.p1.requestState` is `'move' | 'switch' | 'teampreview' | ''`.
* `battle.choose('p1', 'move 1')` returns `boolean`; on `false` the reason is in `battle.p1.choice.error`.
  When both sides have chosen, the turn commits automatically and `send('update', lines)` fires.
  Choice strings: `move N` (1-based index into `request.active[0].moves`), `move N mega`, `move N zmove`,
  `move N terastallize`, `switch N` (1-based index into `request.side.pokemon`, where index 0 is the active Pokémon).
* `request.side.pokemon[i]` has `ident` (`"p1: Garchomp"`), `details` (`"Garchomp, L100, F"`), `condition`
  (`"338/338"`, `"120/338 brn"`, `"0 fnt"`), `active`, `stats`, `moves` (ids), `baseAbility`, `item`.
* The protocol log contains `|split|pX` markers. The line **after** `|split|pX` is the secret (exact-HP) version,
  and the line after that is the public (percentage) version of the same event. Keep the secret line, drop the public one.
* `battle.ended`, `battle.winner` (player name string or `''` for a tie), `battle.turn`, `battle.inputLog`
  (`>start …`, `>player p1 …`, `>p1 move bodypress`, …) all exist. `battle.toJSON()` / `Battle.fromJSON()` also exist
  but we persist by **replaying `inputLog` choices** (deterministic given the same seed + teams).
* `TeamGenerators.getTeamGenerator('gen9randombattle', prng)` → generator with `getTeam()` and
  `randomSet(species, teamDetails = {}, isLead = false, isDoubles = false)`. `generator.randomSets[speciesId]` is the set
  table — **`randomSet` throws for species not in it**, so always check first. Gen 9 covers 508 species/forms,
  gen 8 (`gen8randombattle`) also throws when missing; `gen7randombattle` (575 entries) and older use learnsets and
  work for **any** species of that gen's dex (NFEs included). Sets returned have `level` set by the generator (e.g. 74) — override it.
* `@pkmn/dex`: `Dex.forGen(9).species.all()` → 1517 entries; filter `num > 0 && (isNonstandard === null || isNonstandard === 'Past')`
  for the National Dex (1365 incl. forms, 1025 base species). `species.gen`, `species.tags`
  (`'Sub-Legendary' | 'Restricted Legendary' | 'Mythical' | 'Ultra Beast' | 'Paradox'`), `species.battleOnly`,
  `species.requiredItem`, `species.forme`, `species.baseSpecies`, `species.prevo`, `species.evos`, `species.nfe`.
  `await dex.learnsets.get(id)` → `{learnset: {moveid: ['9M','8L1',…]}}`. Walk `prevo` for inherited moves.
* `@pkmn/img`: `Sprites.getPokemon('Garchomp', {gen: 'gen5ani', side: 'p2'})` → `https://play.pokemonshowdown.com/sprites/gen5ani/garchomp.gif`
  (`side: 'p1'` → `gen5ani-back`). `{gen: 'gen5'}` → static PNG. `Sprites.getAvatar('cynthia')` → trainer PNG.
  `Icons.getPokemon(name)` → sprite-sheet CSS for 40×30 party icons.
* Showdown battle backgrounds exist at `https://play.pokemonshowdown.com/sprites/gen6bgs/bg-<name>.jpg` for:
  beach, city, dampcave, deepsea, desert, forest, icecave, meadow, skypillar, library, elite4drake, leaderwallace,
  earthycave, darkcity, orasdesert, orassea, darkmeadow, darkbeach, aquacordetown.
* Trainer avatars confirmed on `https://play.pokemonshowdown.com/sprites/trainers/<id>.png`:
  red, red-gen1, red-gen3, red-gen7, red-masters, blue, blue-gen7, blue-masters, cynthia, cynthia-gen4, cynthia-masters,
  cynthia-anime, steven, steven-gen6, steven-masters, wallace, wallace-gen6, wallace-masters, lance, lance-gen3,
  lance-masters, alder, iris, iris-gen5bw2, iris-masters, diantha, diantha-masters, leon, leon-masters, geeta,
  nemona-masters (plain `nemona` is missing), giovanni, giovanni-gen3, giovanni-masters, n, n-masters, ghetsis, silver,
  silver-gen2, silver-masters, wally, wally-masters, oak, oak-gen1, kukui, volo, arven-masters (plain `arven` is missing),
  penny, kieran, kieran-masters.
* `@pkmn/view`: `new LogFormatter('p1', clientBattle)` where `clientBattle = new (await import('@pkmn/client')).Battle(new Generations(Dex))`;
  feed every protocol line to `clientBattle.add(line)` **and** call `formatter.formatText(args, kwArgs)` to get text like
  `"Garchomp used **Earthquake**!"`, `"It's super effective!"`, `"The opposing Spiritomb fainted!"`. Strip `**`.
* `@pkmn/sim` + `@pkmn/randoms` bundle fine for the browser with Next/Turbopack (dynamic `import()` takes ~270 ms, a full battle ~40 ms).

## Directory layout and ownership

```
src/
  app/                      Next.js routes (App Router). Pages are thin; game logic lives in src/lib.
    layout.tsx globals.css page.tsx (home)
    daily/ battle/ boss-rush/ custom/ trainers/ trainers/[id]/ pokedex/ pokedex/[id]/ stats/ settings/ about/
  components/
    layout/   Nav, Shell, Footer
    ui/       Button, Card, Panel, TypeBadge, Modal, StatBar …
    battle/   BattleScreen and everything inside the battle viewport (DS-style UI)
    team/     TeamPreview, PokemonCard, LeadPicker, TeamSettingsForm
    trainers/ TrainerCard, TrainerGrid
    pokedex/  Pokédex list/detail components
    stats/    Statistics dashboard components
  lib/
    battle/   types.ts (contract), legal.ts, session.ts, protocol.ts, snapshot.ts, persistence.ts
    ai/       types.ts (contract), index.ts (createOpponentAI), evaluate.ts, damage.ts
    teams/    types.ts (contract), pool.ts, generate.ts, fallbackSet.ts, spreads.ts
    game/     modes: daily.ts, bossRush.ts, results.ts (turn a finished battle into stats)
    storage/  types.ts (contract), stats.ts, settings.ts, battleSave.ts  (all localStorage, SSR-safe)
    assets/   provider.ts (asset-provider abstraction; default = Showdown CDN)
    data/     dex.ts (shared Dex instance + helpers), typeColors.ts, pokeapi.ts (cached PokéAPI fetches)
    util/     seed.ts (string → PRNG seed hashing), misc helpers
  data/
    trainers/ types.ts, index.ts, arenas.ts, <trainer-id>.ts (one file per trainer)
scripts/
  validate-trainers.mts     checks every trainer set against the dex + learnsets
tests/                      cross-module integration tests
```

Everything under `src/lib` must be importable in Node (vitest) **and** the browser. Never touch `window`/`localStorage` at module
top level; guard with `typeof window !== 'undefined'`. Heavy libraries (`@pkmn/sim`, `@pkmn/randoms`, `@pkmn/dex`) are
loaded with dynamic `import()` inside functions so the landing page stays light. Use `import type` for their types.

Path alias: `@/` → `src/`.

## Core contract: `src/lib/battle/types.ts`

See the file. Summary:

* `BattleConfig` — teams (as Showdown `PokemonSet[]`), names, seed, format, opponent difficulty/trainer id.
* `BattleSnapshot` — authoritative view of the whole battle read directly from the sim's `Battle` object after each
  advance (`turn`, both `SideView`s with every `PokemonView`, `FieldView`, `ended`, `winner`).
* `BattleEvent[]` — the ordered, parsed protocol events for the lines produced since the previous advance. Each carries
  `text` (in-game message, may be `''` for events that have no dialogue such as `damage`) and enough data for the
  renderer to animate (ident, side, hp/maxhp, move name, status, boosts, effectiveness…).
* `PlayerRequest` — what the player must decide now: `move` (with `MoveView[]`, trapped/mega/ultra flags), `switch` (forced
  replacement; `reviving: true` after Revival Blessing means the targets are the fainted party members), or `wait`.
* `TurnResult` — `{events, snapshot, request, ended, winner}` returned by every session advance.
* `BattleSession` interface — `start()`, `submit(choice)`, `forfeit()`, `snapshot()`, `request()`, `serialize()`.
  `createBattleSession(config, {ai})` and `restoreBattleSession(saved, {ai})` are async (dynamic import of the sim).

### Session turn flow (`src/lib/battle/session.ts`)

1. `createBattleSession(config)` dynamically imports `@pkmn/sim`, builds the `Battle` with `DEFAULT_FORMAT` (or `config.formatid`)
   and the seed, wires `send` to collect lines, then `setPlayer('p1', player)` and `setPlayer('p2', opponent)`.
   Teams are passed exactly as given (lead = index 0). Sets must have `level` set (50 or 100).
2. `start()` parses the lines produced by setup (player intro, `|switch|` of both leads, `|turn|1`) into events, builds the snapshot and the
   p1 request and returns a `TurnResult`. (Intro text is rendered by the UI from the trainer data, not from these events.)
3. `submit(choice)`:
   * Validate with `battle.choose('p1', choice)`; if it returns `false`, return `{ok: false, error}` — the UI re-prompts. Do not advance.
   * If p2 must also act (its request is not `wait`), ask the `OpponentAgent` for a choice; if `battle.choose('p2', …)` rejects
     it, fall back to the first legal choice from `listLegalChoices(request)` (never let the battle hang).
   * After the turn commits, loop: while the battle is not ended and p1's request is `wait` while p2 has a `forceSwitch`,
     let the AI choose the replacement and continue. Stop when p1 has a `move` or `switch` request or the battle ended.
   * Return all events produced during this call (one contiguous animation timeline) plus the snapshot and the new request.
4. `forfeit()` calls `battle.forfeit('p1')` (or equivalent via `battle.choose`/`lose`) and returns the final result with `winner: 'p2'`.
5. `serialize()` → `{version: 1, config, inputLog: battle.inputLog}`. `restoreBattleSession` re-creates the battle from
   `config` (same seed and teams) and replays every `>p1 …` / `>p2 …` line through `battle.choose` with events suppressed.
   Reject (throw) if the replay diverges (a choice is refused) so the UI can start fresh.

Protocol parsing (`protocol.ts`) must handle `|split|`, ignore `|request|`, `|t:|`, `|j|`, `|l|`, `|c|`, `|raw|`, `|html|`, `|inactive|` lines,
and map everything else to `BattleEvent`s. Unknown lines become `{kind: 'message', text}` (or are dropped when the text is empty).
Text comes from `@pkmn/view`'s `LogFormatter` (perspective `p1`), with `**` stripped. The opponent's Pokémon are
referred to as "The opposing X" automatically by the formatter.

Snapshot (`snapshot.ts`) reads the sim objects directly: `side.pokemon` (request order — slot 0 is active), `pokemon.hp`,
`maxhp`, `status`, `boosts`, `moveSlots` (`pp`, `maxpp`, `disabled`), `item`, `ability`, `types` (`getTypes()`),
`volatiles` keys, `species.name`, `level`, `gender`, `set.shiny`, `side.sideConditions` (layers from `.layers` where present),
`battle.field.weather`, `battle.field.terrain`, `battle.field.pseudoWeather`. For the **opponent** side use
`pokemon.illusion?.species ?? pokemon.species` for display. Move metadata (`type`, `category`, `basePower`, `accuracy`,
`priority`, `shortDesc`) comes from `battle.dex.moves.get(id)`.

## AI contract: `src/lib/ai/types.ts`

`createOpponentAI(difficulty): OpponentAgent`; `agent.choose(ctx)` returns a choice string that is legal for `ctx.request`.
`ctx` gives the live sim `Battle`, the AI's `Side`, the request, a `PRNG`, and the difficulty. The AI may read the full
current battle state (both teams' current HP, stats, moves — this is what makes it strategic) but it must never peek at
the player's pending choice (it is always invoked before the player's choice is committed anyway, so there is nothing to peek at).

Scoring guidelines:
* For each legal move estimate damage with `@smogon/calc` (gen 9), convert to % of the target's current HP, compute KO
  probability (min/max rolls), apply accuracy, STAB/effectiveness are already included by the calc.
* Value status moves by context: setup when the AI's Pokémon is healthy and the opponent can't threaten it, recovery when
  below ~50 %, hazards early, status (burn physical attackers, paralyze faster threats, sleep when Sleep Clause allows),
  Protect to scout/stall, never use a status move on an immune target or one that already has a status.
* Switching: if the opponent threatens a likely KO this turn and a bench Pokémon resists/is immune and has a better
  matchup, switch (hard/champion only). Never switch into a worse matchup, never switch when the active Pokémon can KO.
* Priority moves when they KO. Avoid moves the target is immune to (type, ability like Levitate/Flash Fire/Water Absorb).
* `normal`: evaluate only the active Pokémon's moves, add noise (±30 %) and 15 % chance to pick a random legal move.
* `hard`: full move + switch evaluation, no noise.
* `champion`: like hard, plus one-ply lookahead of the player's best damaging reply when comparing options, and
  smarter use of mega evolution (`move N mega` on the first turn it is available, unless it's worse).
* Forced switches: pick the bench Pokémon with the best matchup (type-based offensive and defensive score).
* Must always return a legal choice; use `listLegalChoices` from `src/lib/battle/legal.ts` as the universe.

## Team generation contract: `src/lib/teams/types.ts`

`generateTeam(settings, seed): Promise<PokemonSet[]>` — deterministic for the same `settings` + `seed` string (use
`seedFromString` in `src/lib/util/seed.ts` and the sim `PRNG` for all randomness; never `Math.random`).

Pool rules:
* National Dex species only (`num > 0`, `isNonstandard` ∈ {null, 'Past'}); drop CAP/Custom/LGPE/Future.
* Drop `battleOnly` forms, Mega/Primal/G-Max/Totem/cosplay/Pikachu-cap/Pokéstar forms, Eternamax, and forms that only
  differ cosmetically (`cosmeticFormes`). Keep regional forms and standalone alt forms (Rotom-Wash, Lycanroc-Dusk, Giratina-Origin, …).
* `gens`: keep species whose `species.gen` is in the selection (regional forms count as the gen they were introduced).
* `legendaries`: `'all'` keeps everything; `'no-restricted'` removes `tags` containing `'Restricted Legendary'` and Mythicals;
  `'none'` also removes `'Sub-Legendary'`, `'Ultra Beast'`, `'Paradox'`.
* `mode`:
  * `balanced` (default): pool = species that have a Showdown random-battle set in gen 9, gen 8 or gen 7 generators
    (viable Pokémon). Pick 6 distinct base species, at most 2 sharing a type, at most 1 with an NFE Eviolite set,
    weighted uniformly. Sets from the generators (gen 9 → gen 8 → gen 7 fallback order).
  * `competitive`: like balanced but weight species by base-stat total (BST ≥ 500 ×3 weight, ≥ 560 ×5) and prefer gen 9 sets.
  * `random`: uniform over the whole filtered pool (NFEs included); set from a generator when available, otherwise
    `buildFallbackSet` (learnset-based heuristics: STAB attacks on the better attacking stat, coverage, one utility/setup
    move, best ability, sensible item).
  * `chaos`: uniform species, 4 random learnable moves, random ability, random item from a fun list, random nature.
* After set selection: force `level` to `settings.level`, IVs 31, and apply a competitive EV spread + nature derived from the
  set's role/moves (`spreads.ts`): physical attacker → 252 Atk / 252 Spe / 4 HP Jolly or Adamant; special → 252 SpA / 252 Spe / 4 HP
  Timid or Modest; mixed → 252 Atk/SpA split with Naive/Rash etc.; defensive/support → 252 HP + 252 Def or SpD (Bold/Impish/Calm/Careful)
  based on which defensive stat is lower and whether the set has recovery. Trick Room sets keep Speed at 0 IVs/Brave/Quiet.
* Species Clause: never two of the same base species. Never two of the same item is **not** required.
* Return `PokemonSet[]` (from `@pkmn/sim`): `{name, species, item, ability, moves (ids or names), nature, gender?, evs, ivs, level, shiny?, teraType?}`.

## Trainer data contract: `src/data/trainers/types.ts`

One file per trainer (`src/data/trainers/<id>.ts`) exporting a `Trainer`. `index.ts` imports all of them and exports
`TRAINERS`, `getTrainer(id)`, `CHAMPIONS`, `OTHER_TRAINERS`. Teams are canonical where possible and labeled with
`canonical: true/false` + `teamNotes`. Moves/items/abilities must exist in the gen 9 dex, and every move must be in the
species' (or a pre-evolution's) learnset — `npm run validate:trainers` enforces it. Sets are full competitive sets (nature,
EVs, item, ability, 4 moves). Mega stones are allowed (NatDex). Levels are set by the battle (50/100), leave `level` unset.

Difficulty (1–5 stars) drives Boss Rush ordering and the default AI difficulty: 1–2 → `normal`, 3 → `hard`, 4–5 → `champion`.

## Asset provider: `src/lib/assets/provider.ts`

All sprite/portrait/background URLs go through `assets` (the default `ShowdownAssetProvider`). Components never build
URLs themselves. Pokémon sprites use the **Showdown gen 5 theme** (`gen5ani` animated GIFs, `gen5ani-back` for the player's
side, `gen5` static PNGs for menus, `Icons.getPokemon` for party icons). Components must render a fallback (static PNG →
dex sprite → Poké Ball placeholder) via `onError` so a missing asset never breaks the game.

## Storage: `src/lib/storage`

localStorage keys: `pc:stats` (PlayerStats), `pc:settings` (UserSettings), `pc:daily:<YYYY-MM-DD>` (DailyRecord),
`pc:battle:<saveKey>` (one SavedBattle per mode key — `free`, `daily-<date>`, `bossrush`, `custom` — for refresh-resume; a battle is
only resumed when its saveKey, seed and opponent match the setup being started), `pc:bossrush` (BossRushRun). All accessors are SSR-safe and
tolerate corrupt JSON (fall back to defaults). See `src/lib/storage/types.ts`.

## Game modes (`src/lib/game`)

* **Daily** — `dateKey = YYYY-MM-DD` in UTC. `teamSeed = 'daily-team-' + dateKey`, `battleSeed = 'daily-battle-' + dateKey`.
  Trainer of the day: `DAILY_ROTATION[daysSinceEpoch(dateKey) % DAILY_ROTATION.length]` (rotation = all trainers ordered as
  in `TRAINERS`). Default generation settings. One official attempt per day: the record is created when the battle starts
  (status `in-progress`) and finalized on finish; refreshing resumes the saved battle. Result card shows W/L, Pokémon remaining,
  turns, current streak, total wins, win %, and a share text block (emoji grid of the six Pokémon: 🟢 alive / 🔴 fainted).
* **Free Battle** — pick trainer → generate team (reroll allowed, settings allowed) → pick lead → battle. Fresh team each battle.
* **Boss Rush** — trainers in ascending difficulty (ties by name). Option "keep my team" (HP/PP restored between fights by
  re-creating the battle with the same sets). Track trainers defeated; best run is stored in stats.
* **Custom** — all settings exposed: opponent, gens, level, mode, difficulty, legendaries, format (`gen9nationaldex@@@!Team Preview`
  or `gen9anythinggoes@@@!Team Preview` labeled "Gen 9 only (no Megas/Z-Moves)").

## Battle UI (`src/components/battle`)

`<BattleScreen setup={BattleSetup} onFinish={(result) => …} />` (types in `src/lib/battle/types.ts`). Owns the session,
the animation queue, the DS-style layout and all menus. Phases: `loading` → `intro` (trainer portrait + "Champion Cynthia
challenges you!" + both lead send-outs) → `playing` (events animate, then the action menu appears for the current request)
→ `ended` (result overlay with trainer dialogue and buttons). Animations are purely presentational: the authoritative state
is always the last `BattleSnapshot`; when the queue finishes, the UI snaps to the snapshot before showing the menu.

Visual spec: large 4:3-ish viewport; opponent sprite upper-right with HP box upper-left; player's back sprite lower-left with HP box lower-right
(name, level, gender, status chip, HP bar green/yellow/red by %, numeric HP only for the player, EXP bar decoration);
dialogue box along the bottom; action menu (FIGHT / POKÉMON / BAG / FORFEIT) to the right of the dialogue box on desktop
and below it on mobile; FIGHT opens a 2×2 grid of move buttons colored by type showing PP and type, with a details panel on hover/focus
(category, power, accuracy, description); POKÉMON opens the party list (icons, HP bars, status, disabled when fainted/active);
BAG shows "Items are disabled in competitive battles." FORFEIT confirms before ending. Attack animations: attacker lunge + screen flash /
type-colored burst on the target + target shake; HP bars drain smoothly; faint = sprite drops and fades; switch = ball throw
+ sprite pop-in; status chips; weather tint. Speed setting (normal / fast / instant). Keyboard accessible. Mobile responsive.

Fonts are exposed by `app/layout.tsx` as CSS variables: `--font-display` (Press Start 2P), `--font-pixel` (VT323) and
`--font-ui` (Nunito). The battle UI uses `var(--font-pixel)` for dialogue and `var(--font-ui)` elsewhere.

## Coding rules

* TypeScript strict; no `any` unless interfacing with the sim's loosely typed objects (then isolate it in one place).
* No placeholders, no fake simulations. If something can't be done, say so in the final report.
* Every lib module gets vitest coverage for its contract (deterministic seeds).
* Components: function components, `'use client'` only where needed. Tailwind utility classes; small CSS modules for keyframes.
* Keep bundle sanity: dynamic-import the sim/dex in client code.
