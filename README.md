# Vite Cell Surface Proof Matrix

This repo isolates one question:

* Can a client import `{ A }` from `../lib/a`, call `A.Browser.thing()`, keep `A.Node` in the same public namespace, and rely on modern Vite to keep the Node branch out of the browser?

There is intentionally no `vite.config.*` file anywhere in this repo. The point is to test module-surface behavior directly, not to hide the problem behind config.

The shape under test is:

```js
// src/main.js
import { A } from '../lib/a'

A.Browser.thing()
```

```js
// lib/a/index.js
export * as A from './index.mod.js'
```

```js
// lib/a/index.mod.js
export * as Browser from './browser.js'
export * as Node from './node.js'
```

## Current Conclusion

The current answer is:

* this is not a config artifact; there is no Vite config in this repo
* ESM namespaces and flat ESM barrels behave the same in these tests
* the real dev seam is an otherwise-unused branch that imports a browser-incompatible Node builtin
* browser-safe unused branches work
* runtime object aggregation is a real app-surface bug because it even breaks production tree-shaking

So the seam is not "ESM namespaces are bad." The seam is:

* unused Node-builtin branches still break dev and bundled dev
* runtime object aggregation breaks prod too

## Cases

These are the concrete case apps under [`cases/`](/Users/jasonkuhrt/vite-cell-proof-app/cases):

| Case | Shape | Build | Dev | Bundled Dev |
| --- | --- | --- | --- | --- |
| `esm-namespace-node-builtin` | `index -> index.mod -> Browser/Node`, unused Node branch imports `node:fs` | pass | fail | fail |
| `esm-namespace-browser-safe-unused` | same namespace shape, unused branch is browser-safe | pass | pass | pass |
| `flat-barrel-node-builtin` | flat ESM barrel, unused export imports `node:fs` | pass | fail | fail |
| `flat-barrel-browser-safe-unused` | flat ESM barrel, unused export is browser-safe | pass | pass | pass |
| `runtime-object-node-builtin` | `const A = { Browser, Node }` runtime aggregate | fail | fail | fail |

That matrix is the key result:

* flat barrels and ESM namespaces behave the same
* browser-safe unused branches are fine
* unused branches with Node builtins are where dev and bundled dev break
* runtime object aggregates are a separate production failure

## Why This App Exists

This is testing the exact thesis behind a mixed cell namespace:

* one public import surface
* browser-safe and node-only branches coexisting under it
* no deep import required for the browser consumer
* build already known-good
* dev is the real question

## Why This Is Plausible To Test Now

This repo exists because Vite 8 introduced a new dev capability that, in theory, could close the gap between production tree-shaking and development module serving.

From the official Vite 8 announcement:

> "Full Bundle Mode" (experimental): This mode bundles modules during development, similar to production builds.

Source:

* [vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8)
* local ref: [/Users/jasonkuhrt/repo-references/vite/docs/blog/announcing-vite8.md](/Users/jasonkuhrt/repo-references/vite/docs/blog/announcing-vite8.md#L124)

The Vite "Why" guide explains why this matters:

> Rolldown changes that. Since exceptionally large codebases can experience slow page loads due to the high number of unbundled network requests, the team is exploring a mode where the dev server bundles code similarly to production, reducing network overhead.

Source:

* [vite.dev/guide/why](https://vite.dev/guide/why)
* local ref: [/Users/jasonkuhrt/repo-references/vite/docs/guide/why.md](/Users/jasonkuhrt/repo-references/vite/docs/guide/why.md#L54)

And the exact CLI surface we are leveraging is:

> `--experimentalBundle` `[boolean] use experimental full bundle mode (this is highly experimental)`

Source:

* local ref: [/Users/jasonkuhrt/repo-references/vite/packages/vite/src/node/cli.ts](/Users/jasonkuhrt/repo-references/vite/packages/vite/src/node/cli.ts#L203)

So the theory under test is not vague "modern bundling." It is specifically:

* Vite 8 Full Bundle Mode
* enabled by Rolldown-backed dev bundling
* exposed today as `vite --experimentalBundle`
* with the hope that dev could behave more like production for a mixed namespace such as `A.Browser` and `A.Node`

## Feature Trail

This is the concrete upstream trail for the exact feature under test.

Landing points:

* changelog entry:
  [CHANGELOG.md](/Users/jasonkuhrt/repo-references/vite/packages/vite/CHANGELOG.md#L182)
  and web:
  [github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md#L182](https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md#L182)
* landing PR:
  [vitejs/vite#21235](https://github.com/vitejs/vite/pull/21235)
* merge commit:
  [83d8c99753d8bd5c1ea9b7a00e6998c865dad4e2](https://github.com/vitejs/vite/commit/83d8c99753d8bd5c1ea9b7a00e6998c865dad4e2)

The PR is explicit about scope:

> This PR adds highly experimental full bundle mode.
>
> This is not expected to be used yet, but rather to make the full bundle mode development easier.

Source:

* [vitejs/vite#21235](https://github.com/vitejs/vite/pull/21235)

The landing commit is substantial, not a docs-only tease:

* 36 touched files
* 2,428 changed lines
* includes:
  * `packages/vite/src/node/server/environments/fullBundleEnvironment.ts`
  * `packages/vite/src/node/cli.ts`
  * `packages/vite/src/node/config.ts`
  * `playground/hmr-full-bundle-mode/*`

Immediate follow-up:

* [vitejs/vite#21296](https://github.com/vitejs/vite/pull/21296)
  `fix: unreachable error when building with experimental.bundledDev is enabled`

Relevant follow-up community issues after landing:

* [vitejs/vite#21966](https://github.com/vitejs/vite/issues/21966)
  `Tree-shaking fails for barrel files that combine inline exports with re-exports`
* [vitejs/vite#22012](https://github.com/vitejs/vite/issues/22012)
  `experimental.bundledDev breaks non-bundled environments in multi-environment setups`
* [vitejs/vite#21884](https://github.com/vitejs/vite/issues/21884)
  `Vite 8 regression: DevBundle crashes...`

That trail matters because it tells us this app is testing a real upstream feature with real user pressure and real post-landing rough edges, not an imagined capability.

## Tracked Needs / Seams

This is the working map for our specific use case.

| Need                                                                                                                        | Status                             | Evidence                                                                                                       | Upstream                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does plain dev still choke on an unused branch that imports a Node builtin?                                                | Yes                                | `npm run proof:dev` shows a real browser `pageerror` on `node:fs.readFileSync`                                 | Baseline limitation of native ESM dev                                                                                                                                                              |
| Does bundled dev fix that same case?                                                                                        | No                                 | `npm run proof:dev:bundle` fails before page render with `MISSING_EXPORT` for `node:fs.readFileSync`           | No exact upstream issue found yet; likely needs a new focused report                                                                                                                               |
| Is this specifically an ESM namespace problem?                                                                              | No                                 | `flat-barrel-node-builtin` fails the same way as `esm-namespace-node-builtin`                                  | No exact upstream issue found yet; likely needs a new focused report                                                                                                                               |
| Is this specifically a Node-builtin-in-unused-branch problem?                                                               | Looks like yes                     | both browser-safe cases pass in plain dev and bundled dev                                                       | No exact upstream issue found yet; likely needs a new focused report                                                                                                                               |
| Is runtime object aggregation still a bad public surface?                                                                   | Yes                                | `runtime-object-node-builtin` leaks `readFileSync` into the prod bundle                                         | Related shape class: [vitejs/vite#21966](https://github.com/vitejs/vite/issues/21966)                                                                                                              |
| Is bundled dev still rough beyond our exact case?                                                                           | Yes                                | upstream reports after landing                                                                                 | [vitejs/vite#21296](https://github.com/vitejs/vite/pull/21296), [vitejs/vite#21884](https://github.com/vitejs/vite/issues/21884), [vitejs/vite#22012](https://github.com/vitejs/vite/issues/22012) |

Notes on those seams:

* The important negative result is narrower than "bundled dev is useless." In this proof matrix, bundled dev handles unused browser-safe branches, but hard-fails when the unused branch imports a browser-incompatible Node builtin.
* That means the seam is not just "namespace exports." The seam appears to involve bundled-dev graph processing plus browser-externalized Node builtins before unreachable-branch elimination finishes.
* Runtime object aggregation is its own bad app-surface pattern. It leaks the Node branch into prod even before we get to the bundled-dev question.

## References

Official Vite references:

* Vite 8 announcement, Full Bundle Mode is still experimental:
  [vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8)
* Vite “Why” guide, full bundle mode is still an explored direction:
  [vite.dev/guide/why](https://vite.dev/guide/why)
* Vite changelog entry calling full bundle mode “highly experimental”:
  [github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md](https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md)

Official Vite+ references:

* Vite+ README says `vp dev` runs Vite’s native ESM dev server:
  [github.com/voidzero-dev/vite-plus/blob/main/README.md](https://github.com/voidzero-dev/vite-plus/blob/main/README.md)
* Vite+ CLI agent docs say `vp dev` works the same as Vite:
  [github.com/voidzero-dev/vite-plus/blob/main/packages/cli/AGENTS.md](https://github.com/voidzero-dev/vite-plus/blob/main/packages/cli/AGENTS.md)

Local source references used during this spike:

* `/Users/jasonkuhrt/repo-references/vite`
* `/Users/jasonkuhrt/repo-references/vite-plus`

## Commands

```sh
npm run proof:build
npm run proof:dev
npm run proof:dev:bundle
npm run proof:matrix
npm run proof:matrix:build
npm run proof:matrix:dev
npm run proof:matrix:dev:bundle
```
