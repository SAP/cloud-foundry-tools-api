# cloud-foundry-tools-api

Node.js library (`@sap/cf-tools`) providing a TypeScript API for interacting with Cloud Foundry. Wraps the CF CLI, runs commands, and parses their JSON output. Error handling is operation-specific: many wrappers reject with an Error, while `cfLogin` returns `OK` on success or failure output otherwise.

## Architecture

Single-package library (`src/`):

- **`index.ts`** — public entry point; re-exports types, CLI, CF wrappers, messages, and shared helpers and defines high-level `api*` convenience functions.
- **`types.ts`** — all public interfaces, enums, and constants (`CFTarget`, `ServiceInstanceInfo`, `ServiceTypeInfo`, `eFilters`, `eOperation`, etc.).
- **`cf-local.ts`** — core CF command wrappers (`cfLogin`, `cfGetAvailableSpaces`, `cfGetServices`, etc.).
- **`cli.ts`** — low-level CLI execution layer; spawns `cf` as a subprocess and captures output.
- **`cfServicesUtil.ts`** — service instance utilities used by the `api*` functions in `index.ts`.
- **`utils.ts`** — shared helpers.
- **`messages.ts`** — user-facing error/status messages.
- **`task.ts`** — internal helper that saves VS Code task configuration to `.vscode/tasks.json`; it is not re-exported by `index.ts`.

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
- **`release.yml`** — triggered by `v*.*.*` tags; runs tests, packs the package (`npm pack`), creates a GitHub Release containing the tarball. The checked-in workflow does not publish to npm.
- **`commitlint.yml`** — enforces conventional commit message format.

To cut a release:

```sh
npm run release          # standard-version: bump version, update CHANGELOG, commit, tag
git push --follow-tags origin main  # push commit + tag → triggers release.yml
```

## Configuration

CF CLI v8 must be on `PATH`. Install the npm dependencies declared in `package.json` as well. CF operations use the CLI login and target state; authenticate and target the intended org/space before calling operations that require them. `cfLogin` accepts an options object, and `cfGetAvailableSpaces` accepts an organization GUID, not its display name. Local binding operations also read or write environment files.

## Prerequisites

- Node.js 24 to match the checked-in CI workflow
- CF CLI v8 (`cf` on PATH) — https://github.com/cloudfoundry/cli/releases
- `npm install` to install dev dependencies (including TypeScript, Mocha, ESLint, Prettier)
