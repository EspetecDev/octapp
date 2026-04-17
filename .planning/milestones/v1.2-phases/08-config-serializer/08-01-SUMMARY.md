---
phase: 08-config-serializer
plan: 01
subsystem: api
tags: [typescript, serialization, validation, json]

# Dependency graph
requires:
  - phase: 04-group-economy-multiplayer
    provides: Chapter, PowerUp, TriviaQuestion types used as base for ConfigChapter and GameConfig
provides:
  - GameConfig type (version: 1 literal, ConfigChapter[], PowerUp[], startingTokens)
  - serializeConfig() — strips runtime-only fields from Chapter[] before export
  - validateConfig() — validates unknown input against GameConfig shape with field-specific error messages
  - ConfigChapter type — Chapter without servedQuestionIndex, minigameDone, scavengerDone
  - ValidateConfigResult discriminated union
affects: 08-config-serializer plans 02+, any feature that reads or writes game configuration JSON

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Omit<T, keys> for deriving config types from runtime types without duplication"
    - "Discriminated union return type ({ ok: true; config } | { ok: false; error }) for validation functions"
    - "Destructuring-based runtime field stripping: const { runtimeField: _ignored, ...rest } = item"

key-files:
  created:
    - src/lib/configSerializer.ts
  modified:
    - src/lib/types.ts

key-decisions:
  - "version field is literal type 1 (not number) — TypeScript enforces exact value at compile time"
  - "validateConfig is permissive of extra fields — only checks required structural fields, never strict"
  - "Re-export via types.ts so downstream consumers can import from either $lib/types or $lib/configSerializer"
  - "ConfigChapter uses Omit<Chapter, ...> rather than a hand-duplicated type — single source of truth"

patterns-established:
  - "Runtime-field stripping pattern: destructure with _ prefix aliases, spread rest into config shape"
  - "Discriminated union ValidateConfigResult: { ok: true; config: GameConfig } | { ok: false; error: string }"

requirements-completed: [SER-01, SER-02, SER-03]

# Metrics
duration: 2min
completed: 2026-04-14
---

# Phase 8 Plan 01: Config Serializer — GameConfig Type + serializeConfig + validateConfig Summary

**Pure-function serialization boundary: GameConfig type with literal version, ConfigChapter stripping three runtime fields, and validateConfig returning field-specific error messages.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-14T09:48:12Z
- **Completed:** 2026-04-14T09:50:06Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- Created `configSerializer.ts` with all required exports: `GameConfig`, `ConfigChapter`, `ValidateConfigResult`, `serializeConfig`, `validateConfig`
- `serializeConfig` correctly strips `servedQuestionIndex`, `minigameDone`, `scavengerDone` from every chapter via destructuring
- `validateConfig` returns discriminated union with field-specific error messages for all invalid-input cases; permissive of extra fields
- Re-exported `GameConfig` from `src/lib/types.ts` so it is importable from either module path
- Smoke test via `bun -e` prints "ALL PASS"; TypeScript strict-mode compiles clean (only pre-existing unrelated TS2688 error present)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create configSerializer.ts** - `5d6a19a` (feat)
2. **Task 2: Re-export GameConfig from types.ts** - `143ce90` (feat)

**Plan metadata:** (final commit below)

## Files Created/Modified
- `src/lib/configSerializer.ts` — GameConfig type, ConfigChapter type, ValidateConfigResult union, serializeConfig(), validateConfig()
- `src/lib/types.ts` — one-line re-export of GameConfig from $lib/configSerializer

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a pure-function module with no UI rendering or data sources.

## Self-Check: PASSED

- `src/lib/configSerializer.ts` exists and exports all required names
- `src/lib/types.ts` contains `export type { GameConfig } from "$lib/configSerializer"`
- Commits `5d6a19a` and `143ce90` exist in git log
- Smoke test prints "ALL PASS"
