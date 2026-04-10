# Vite Cell Surface Proof Matrix

Minimal repro repo for one Vite 8 question: can Full Bundle Mode make dev behave like production build for a mixed public surface that contains both browser-safe and Node-only branches?

## Grounding

This repo is a small lab for Vite 8, not an app template. Each case is a tiny browser app plus a tiny library surface under `lib/a/`.

The library surface changes shape across cases:

* namespace barrel
* flat barrel
* runtime object aggregate

The branch content also changes:

* browser-safe unused branch
* unused branch that imports `node:fs`

## Problem

Production build tree-shaking has handled many of these patterns for years. The interesting question is dev.

Vite 8 introduced Full Bundle Mode, which in theory should move dev closer to production bundling. This repo checks whether that new mode is enough for mixed public surfaces, or whether some shapes still break.

## Solution

This repo keeps the experiment small and explicit:

* no `vite.config.*`
* five tiny case apps under `cases/`
* scripted checks for production build, plain dev, and bundled dev
* real browser verification for dev via Playwright

The point is to separate three questions cleanly:

1. Is our app surface bad?
2. Is our Vite config bad?
3. Is bundled dev itself still limited here?

## Quickstart

```sh
npm install
npm run repro
```

That runs the full matrix:

* production build
* plain dev
* bundled dev via `vite --experimentalBundle`

If you only want the main failing case:

```sh
npm run repro:case:build
npm run repro:case:dev
npm run repro:case:bundled-dev
```

## Concepts

The key concept in this repo is the **public surface**. That is the browser-visible API shape the consumer imports.

A **namespace barrel** means the consumer imports a namespace object created entirely through ESM re-exports:

```js
export * as A from './index.mod.js'
```

A **flat barrel** means the consumer imports named exports re-exported from multiple modules:

```js
export { thing } from './browser.js'
export { getSecret } from './node.js'
```

A **runtime object aggregate** means the library builds the public surface at runtime:

```js
const A = { Browser, Node }
export { A }
```

An **unused Node builtin branch** means the browser consumer does not call that branch, but the branch still imports a Node builtin like `node:fs`.

That distinction matters because this repo is testing whether Vite can eliminate the bad branch early enough in dev, not whether the branch is valid browser code by itself.

## Cases

| Case | Surface | Unused branch | Build | Plain dev | Bundled dev |
| --- | --- | --- | --- | --- | --- |
| `namespace-browser-safe` | namespace barrel | browser-safe | pass | pass | pass |
| `namespace-node-builtin` | namespace barrel | `node:fs` | pass | fail | fail |
| `barrel-browser-safe` | flat barrel | browser-safe | pass | pass | pass |
| `barrel-node-builtin` | flat barrel | `node:fs` | pass | fail | fail |
| `runtime-object-node-builtin` | runtime object aggregate | `node:fs` | fail | fail | fail |

## Usage

Run the whole matrix:

```sh
npm run repro
```

Run one mode across all cases:

```sh
npm run repro:build
npm run repro:dev
npm run repro:bundled-dev
```

Run the main motivating case only:

```sh
npm run repro:case:build
npm run repro:case:dev
npm run repro:case:bundled-dev
```

Open the default failing case in a manual server:

```sh
npm run serve
npm run serve:bundled
```

## Results

Current takeaways:

* This is not a config artifact. There is no Vite config in this repo.
* This is not specifically an ESM namespace problem. Namespace barrels and flat barrels behave the same here.
* Browser-safe unused branches are fine in both plain dev and bundled dev.
* An unused branch that imports `node:fs` still breaks both plain dev and bundled dev.
* Runtime object aggregation is a separate app-surface bug because it leaks the Node branch into production build output too.

So the important seam is:

* bundled dev still does not match production build when an otherwise-unused pure-ESM branch imports a browser-incompatible Node builtin

## Upstream Context

Why this repo exists at all:

> "Full Bundle Mode" (experimental): This mode bundles modules during development, similar to production builds.

Source:

* [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)

The exact CLI surface under test is:

* `vite --experimentalBundle`

Relevant upstream trail:

* [Full Bundle Mode landing PR: vitejs/vite#21235](https://github.com/vitejs/vite/pull/21235)
* [Follow-up fix: vitejs/vite#21296](https://github.com/vitejs/vite/pull/21296)
* [Bundled-dev rough edge: vitejs/vite#21884](https://github.com/vitejs/vite/issues/21884)
* [Tree-shaking issue in related barrel shapes: vitejs/vite#21966](https://github.com/vitejs/vite/issues/21966)
* [Maintainer statement for another unsupported bundled-dev setup: vitejs/vite#22012](https://github.com/vitejs/vite/issues/22012)

Important nuance:

* this repo proves behavior
* it does not yet prove intent

At the time of writing, this repo has not found an exact existing Vite issue for the specific seam reproduced here.

## Glossary

#### bundled dev

Vite 8 Full Bundle Mode, currently exercised here via `vite --experimentalBundle`.

#### flat barrel

A public module that re-exports named values directly from other modules.

#### namespace barrel

A public module that exposes a namespace entirely through ESM re-exports.

#### plain dev

Vite's default native-ESM dev server mode.

#### public surface

The API shape that the browser consumer imports.

#### runtime object aggregate

A public surface created by building an object at runtime instead of using pure ESM re-exports.
