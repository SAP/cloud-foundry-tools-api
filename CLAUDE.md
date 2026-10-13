# cloud-foundry-tools-api

Node.js library (`@sap/cf-tools`) providing a TypeScript API for interacting with Cloud Foundry. Wraps the CF CLI, runs commands, and parses their JSON output. Throws typed runtime exceptions on errors.

## Architecture

Single-package library (`src/`):

- **`index.ts`** — public entry point; re-exports from all modules and defines high-level `api*` convenience functions.
- **`types.ts`** — all public interfaces, enums, and constants (`CFTarget`, `ServiceInstanceInfo`, `ServiceTypeInfo`, `eFilters`, `eOperation`, etc.).
- **`cf-local.ts`** — core CF command wrappers (`cfLogin`, `cfGetAvailableSpaces`, `cfGetServices`, etc.).
- **`cli.ts`** — low-level CLI execution layer; spawns `cf` as a subprocess and captures output.
- **`cfServicesUtil.ts`** — service instance utilities used by the `api*` functions in `index.ts`.
- **`utils.ts`** — shared helpers.
- **`messages.ts`** — user-facing error/status messages.
- **`task.ts`** — progress/cancellation token abstractions.

Compiled output goes to `out/src/` (`.js` + `.d.ts`). Published files: `out/src/*.js` and `out/src/*.ts`.

API documentation is generated with TypeDoc and published to https://sap.github.io/cloud-foundry-tools-api.

## Build

```sh
npm install        # install dependencies
npm run compile    # tsc -p ./ → out/
npm run build      # format:validate + lint:validate + test + docs (full local CI)
npm run docs       # regenerate TypeDoc HTML into docs/
```

## Testing

Tests use Mocha + Chai + Sinon; coverage via Nyc.

```sh
npm test           # compile (pretest) then nyc mocha
```

Coverage is uploaded to Coveralls automatically in CI.

## CI/CD & Deployment

GitHub Actions (`.github/workflows/`):

- **`ci.yml`** — runs `npm run test` on Node 24 for pushes and PRs to `main*` branches; uploads coverage to Coveralls.
- **`release.yml`** — triggered by `v*.*.*` tags; runs tests, packs the package (`npm pack`), creates a GitHub Release, and publishes to npm.
- **`commitlint.yml`** — enforces conventional commit message format.

To cut a release:

```sh
npm run release          # standard-version: bump version, update CHANGELOG, commit, tag
git push --follow-tags origin main  # push commit + tag → triggers release.yml
```

## Configuration

No runtime configuration files or environment variables required. The single dependency at runtime is CF CLI v8 on the `PATH`.

## Prerequisites

- Node.js 14+ (LTS recommended; CI runs on 24)
- CF CLI v8 (`cf` on PATH) — https://github.com/cloudfoundry/cli/releases
- `npm install` to install dev dependencies (including TypeScript, Mocha, ESLint, Prettier)
