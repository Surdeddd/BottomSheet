# API reference generation

The library ships with extensive inline JSDoc on every public type, method,
and event. To generate a browseable HTML reference (TypeDoc) for your local
checkout or for a documentation site:

## One-shot

```bash
npm install --save-dev typedoc
npm run docs:api
```

Output lands in `docs/api/`. Open `docs/api/index.html` in a browser.

## Configuration

The TypeDoc config lives at [typedoc.json](../typedoc.json) and covers all
9 entry points (core + 7 framework adapters + overlay subpath). Settings:

- `excludePrivate` / `excludeProtected` / `excludeInternal` — strips
  implementation-detail symbols. Anything tagged `@internal` is hidden.
- `entryPoints` — every public subpath, mirrors the `exports` field in
  `package.json`.
- `sort: source-order` — preserves the order types are declared so related
  types stay grouped (e.g. `EngineOptions` near `Plugin` near `TeardownScope`).

## Publishing the docs site

GitHub Pages workflow stub (drop into `.github/workflows/docs.yml` if you
want auto-publish on `main`):

```yaml
name: API docs
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm install --save-dev typedoc
      - run: npm run docs:api
      - uses: actions/upload-pages-artifact@v3
        with: { path: docs/api }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Why TypeDoc isn't a default dev dep

TypeDoc + its `typedoc-plugin-*` ecosystem adds ~6 MB to `node_modules`.
Most contributors never run docs generation locally — CI bumps it on demand.
The config + script is in place so adding `typedoc` to `devDependencies`
when the docs workflow ships costs one `npm install` line.

## Hand-written docs

Per-adapter usage guides live in `docs/`:

- [react.md](./react.md), [vue.md](./vue.md), [svelte.md](./svelte.md),
  [solid.md](./solid.md), [preact.md](./preact.md), [angular.md](./angular.md),
  [astro.md](./astro.md), [lit.md](./lit.md), [vanilla.md](./vanilla.md),
  [web-component.md](./web-component.md)
- [plugins.md](./plugins.md) — building custom plugins with `Plugin.install`
  and the optional `TeardownScope` argument
- [migration-v2.md](./migration-v2.md) — v1 → v2 deprecation tracker plus
  v1.x stable-contract pin
- [ARCHITECTURE.md](./ARCHITECTURE.md) — internal controller layout, data
  flow, hot-path invariants
