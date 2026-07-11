# Contributing to @surdeddd/bottom-sheet

Thanks for considering a contribution. This is a headless library — every change ripples across 8 framework adapters, so the bar is high. Below is everything you need to ship a clean PR.

## Quick start

```bash
git clone https://github.com/surdeddd/bottom-sheet
cd bottom-sheet
nvm use               # Node >= 20.19 — pinned in .nvmrc (dev toolchain requirement)
npm install
npm run build         # dist/ for SSR tests
npm test              # 500+ unit tests via vitest + happy-dom
npm run e2e           # Playwright e2e (mobile-chrome project; ~200 specs per browser)
npm run demo          # http://localhost:5173 — interactive playground
```

The published package's `engines.node` stays at `>=20` for consumers; the
**dev** toolchain requires **Node >= 20.19** (pinned in `.nvmrc`). All the
library's framework peer deps are optional, so a plain `npm install` resolves
cleanly. If your npm version balks at the `examples/*` workspaces — each
consumes the local lib via `file:../..` — re-run with `--legacy-peer-deps`.

## Repo map

```
src/
├── core/              # framework-agnostic engine (+ overlay, features/, controllers/)
├── react/             # React adapter (Preact re-uses it)
├── preact/            # zero-cost re-export of /react
├── vue/               # Vue 3 SFC adapter
├── svelte/            # Svelte 5 SFC adapter
├── solid/             # Solid adapter (preserved-JSX source bundle)
├── qwik/              # Qwik component adapter
├── web-component/     # native <bottom-sheet> custom element
├── integrations/      # opt-in form-library wrappers (RHF, Formik)
└── styles/            # base CSS + theme presets

tests/
├── unit/              # vitest + happy-dom
└── e2e/               # Playwright (mobile-chrome / mobile-safari / firefox)

demo/                  # vite-served playground (live on bottom-sheet-demo.vercel.app)
docs/                  # per-framework guides + 10 recipes + MIGRATION.md
examples/              # minimal Vite apps for each adapter (StackBlitz-ready)
```

Plugins are a runtime pattern (`engine.use(plugin)`), not a source folder —
see [docs/plugins.md](docs/plugins.md).

## What changes are welcome

- **Bug fixes** — always
- **New adapters** — Angular currently ships as a recipe (`docs/angular.md`); a first-party bundled adapter would be welcome. (React, Preact, Vue, Svelte, Solid, Qwik and the Web Component already ship.)
- **Integrations** — TanStack Form, Final Form, Conform — same shape as `integrations/react-hook-form.ts`
- **Plugin pack** — analytics, haptics, telemetry, devtools panel
- **Theme presets** — additions to `src/styles/themes/*.css`
- **Recipes** — new `docs/recipes/*.md` for production patterns
- **Browser bug workarounds** — flag iOS Safari / Firefox / etc edge cases

## What needs an issue first

- API surface changes (new options, renamed events, breaking type signatures)
- Engine behavior changes (gesture thresholds, spring defaults, new lifecycle hooks)
- Build / packaging changes (tsup config, exports map, peer deps)
- Anything that bumps the bundle size budget

Open an issue, get alignment, then PR.

## Development checklist (before opening a PR)

```bash
npm run typecheck     # tsc --noEmit
npm test              # vitest
npm run e2e           # Playwright
npm run docs:check    # validate doc npm-script refs + internal links (CI-gated)
npm run size          # size-limit — fails CI on regression
npm run sync:css      # if you edited src/styles/bottom-sheet.css
npm run build         # verify dist artifacts
```

A `.husky/pre-commit` hook runs typecheck + vitest + sync:css drift-guard automatically.

## Conventions

- **Comments**: WHY only. Don't explain WHAT — identifiers should do that. Don't reference review findings or PR numbers in code (rot fast).
- **Breaking changes** in adapters: add a JSDoc deprecation notice for one minor before removing.
- **Engine guarantees**: cycle-nonce / destroyed-guard / SSR-safety patterns are non-negotiable. Read `src/core/BottomSheetEngine.ts` before modifying gesture or animation paths.
- **Tests**: new public API needs at least one unit test. Engine-level changes also need an e2e if they touch gesture or animation timing.
- **Bundle**: every entry has a gzip budget in the `size-limit` array in `package.json` — core 22.5 KB, react 26, vue 22, svelte 21.5, solid/qwik 20.5, element 25, overlay 7. `npm run size` gates CI on any regression past these ceilings.

## Publishing a release

Maintainers only. The publish flow is fully automated through
`.github/workflows/release.yml` — there is no manual `npm publish` step.

### One-time setup

1. Generate an npm **Automation** token (or a **Granular access** token
   with `read and write` permission scoped to `@surdeddd/bottom-sheet`):
   - npm web → **Access Tokens** → **Generate New Token** → choose
     **Automation** (recommended — bypasses 2FA in CI) or **Granular**
     (more locked-down; set "Packages and scopes" → `@surdeddd/*`,
     permission `Read and write`, expiration ≤ 1 year).
   - Copy the `npm_…` value once — npm never shows it again.
2. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
   → **New repository secret**:
   - Name: `NPM_TOKEN`
   - Value: the token from step 1.
3. Confirm the repo has **Settings → Actions → General → Workflow
   permissions → Read and write** enabled, so the release job can
   create a GitHub Release.

That's it — never commit the token, never paste it into chat, never
share it with collaborators (issue them their own).

### Cutting a release

```bash
# 1. Make sure main is green and your working tree is clean
git switch main
git pull --ff-only
git status            # must be clean

# 2. Bump version → npm-version creates the commit AND the v* tag
npm version patch     # or: minor | major | 1.2.3 | prerelease --preid=beta

# 3. Push commit + tag in one shot
git push --follow-tags
```

`npm version` writes the new version into `package.json`, commits with
message `vX.Y.Z`, and creates a matching `vX.Y.Z` tag. The
`--follow-tags` flag pushes the tag along with the commit, which fires
the `Release` workflow on GitHub.

### What the workflow does (in order)

1. Checkout with full git history (needed for auto-generated notes).
2. Set up Node 20 + npm registry auth via `NPM_TOKEN`.
3. **Assert tag ↔ `package.json` version match** — aborts on drift.
4. **Refuse duplicate publish** — `npm view` lookup; aborts if the
   version is already on the registry.
5. `tsc --noEmit` — type check.
6. `vitest run` — unit tests.
7. `npm run build` — full lifecycle (prebuild → build → postbuild).
8. `npm run size` — bundle-size budget gate.
9. `npm pack --dry-run` — surface tarball contents into CI logs.
10. `npm publish --provenance --access public` — sigstore attestation
    via the Actions OIDC token (`id-token: write`).
11. `softprops/action-gh-release` — drafts a GitHub Release with
    auto-generated notes from the commits since the previous tag.

### Pre-releases

```bash
npm version 1.0.0-beta.1
git push --follow-tags
```

Tags with `-alpha`, `-beta`, `-rc` suffixes publish under the matching
**dist-tag** (npm's `latest` is reserved for stable). Soft-props
auto-marks the GitHub Release as `prerelease`.

### Rollback

You **cannot** un-publish a version older than 72 hours. Even within
the window, un-publishing breaks downstream installs and is widely
considered hostile. The correct fix is one of:

- **Patch forward**: bump (`npm version patch`), tag, push. The bad
  version stays on the registry but consumers move forward.
- **Deprecate** the bad version with a pointer to the fix:

  ```bash
  npm deprecate '@surdeddd/bottom-sheet@1.2.3' \
    'broken: use 1.2.4+ — see https://github.com/Surdeddd/BottomSheet/releases/tag/v1.2.4'
  ```

- **Yank from latest** (rare): if the bad version was tagged `latest`,
  retag a known-good earlier version:

  ```bash
  npm dist-tag add '@surdeddd/bottom-sheet@1.2.2' latest
  ```

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `tag 'vX.Y.Z' does not match package.json version` | Tag was created without `npm version` | Delete the tag (`git tag -d vX.Y.Z && git push --delete origin vX.Y.Z`), then `npm version` again |
| `…@X.Y.Z already exists on npm` | Re-tag of an already-published version | Bump again with `npm version patch` |
| `404 Not Found - PUT …` | `NPM_TOKEN` missing / wrong scope | Re-issue an Automation token, update the GitHub secret |
| `403 Forbidden - PUT …` (provenance) | Workflow lacks `id-token: write` | Already in `release.yml`; if you forked, restore the permissions block |
| `npm ERR! 402 Payment Required` | Scoped package + missing `--access public` | Already in `release.yml` — don't remove the flag |

## Reporting bugs

Include:
- Minimal repro (CodeSandbox / StackBlitz preferred — see `examples/<framework>/` for templates)
- Browser + OS
- Steps to reproduce
- What you expected vs what happened

For gesture / animation issues, a screen recording is worth a thousand words.

## License

MIT. By contributing you agree your work is licensed under MIT.
