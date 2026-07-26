## What this changes

<!-- The behaviour difference, not a list of edited files. If it fixes an
     issue, link it. -->

## Why

<!-- What was wrong, or what could not be expressed before. -->

## Verification

<!-- What you ran, and what it said. Not "tests pass" — the numbers.
     The full gate set is: npx tsc --noEmit, npx vitest run, npx playwright
     test, npm run size, npm run bench:check, npm run docs:check. -->

- [ ] `npx tsc --noEmit`
- [ ] `npx vitest run`
- [ ] `npx playwright test` (state which projects)
- [ ] `npm run size` — no budget regressed
- [ ] `npm run docs:check`

## Checklist

- [ ] No comments added to `src/` or `demo/` — this codebase keeps none, only
      build pragmas (`@ts-*`, `@jsxImportSource`, `@vitest-environment`,
      `svelte-ignore`)
- [ ] Behaviour change is covered by a test that fails without the fix
- [ ] Public API change is reflected in `docs/` and `CHANGELOG.md`
- [ ] Touched `src/styles/bottom-sheet.css`? Ran `npm run sync:css` and
      committed `src/web-component/baseStyles.ts`
- [ ] Added a subpath export? Wired it into `package.json` exports,
      `tsup.config.ts` (both entry blocks), `tsconfig.json` paths,
      `vite.config.ts` alias, the CI smoke-import loop, and `typedoc.json`
- [ ] Changed the demo's rendered layout? Refreshed the linux baselines via the
      `Visual baselines (linux)` workflow, not just the local darwin ones
