# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@jon49/web` is a published npm package (`lib/`) of small, standalone browser modules for building MVC-style web apps backed by service workers. It ships TypeScript/JavaScript source directly — there is no bundler. Each module in `lib/` is a self-contained side-effecting script that registers global behavior on `window`/`document` when imported into a page.

The `exports` map in `package.json` exposes each module as a `*.js` specifier that resolves to its `*.ts`/`*.js` source in `lib/`. Adding a new public module means adding both the file and an `exports` entry.

## Commands

- **Type-check / emit declarations:** `npx tsc` — config emits declarations only (`emitDeclarationOnly`, `outDir: ./dist`). No JS is bundled or transpiled for shipping; `dist/` and `node_modules/` are gitignored.
- **Tests:** none. The `npm test` script is a placeholder that exits 1.
- **Lint:** none configured. `tsconfig.json` enforces strictness (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`), so `npx tsc` is the closest thing to a lint pass.

Target is `es2024` with `webworker` + `DOM` libs — code may run in either a window or a service worker context.

## Architecture

These modules form a lightweight, server-driven UI system. The two pillars are the **action dispatcher** and the **htmz iframe swap mechanism**, tied together by the `hz:completed` event.

### Action dispatcher (`_action.ts` + `app-actions.ts`)

`_action.ts` installs delegated `click`/`change`/`submit` listeners on `document`. When an event fires, it walks from the target up to find an `_<event>` attribute (e.g. `_click`, `_submit`), falling back to the element's owning `form`. The attribute value is a space-separated list of action names, each looked up on the global `window.app` registry and called as `fn(event, target, form)`.

- `_load` attributes are run once on page `load` and after every `hz:completed`, then the attribute is removed (run-once semantics).
- `app-actions.ts` declares the `window.app` type (`AppAction = (e, el, form?) => 1 | void`) and registers the built-in actions (`redirect`, `refresh`, `theme`, `reset`, `confirm`, `submit`, etc.). An action returning `1` is the convention used by handlers like `confirm` that may `preventDefault`.
- New actions are added by assigning onto `window.app`. `toast.js` and `anchor.ts` show modules extending the registry from their own files.

### htmz swap mechanism (`htmz-be.ts`, `htmz-morph.ts`)

Two interchangeable implementations of the same pattern (pick **one** per app): a hidden `<iframe name=htmz>` receives server responses. On the iframe's `load`, `window.htmz()` iterates the response's body/head children and swaps each into the main document:

- `hz-target` attribute (or the element's `id`) selects the destination via `querySelector`.
- `hz-swap` attribute names the DOM method to apply (`replaceWith` default in `htmz-be`; `before`/`prepend`/`append`/`after`/etc.). `<template>` elements have their `content` cloned before swapping.
- `htmz-morph.ts` differs by using `morphdom` (the sole runtime dependency) for in-place diffing when no `hz-swap` is given, preserving DOM state instead of replacing.

After swapping, both dispatch `document` event `hz:completed` and reset the iframe to `about:blank`. `hz:completed` is the system-wide "DOM changed" signal — `_action.ts` (re-runs `_load`) and `anchor.ts` (restores scroll) both listen for it.

### Supporting modules

- `anchor.ts` — preserves scroll position across submit→swap cycles by recording an element's viewport offset on `submit` and restoring it on `hz:completed`.
- `user-messages.ts` — listens for a `user-messages` CustomEvent and clones a `#toast-template` into `#toasts`, computing a display timeout from word count. `toast.js` registers the `toast` action that removes a toast after `data-timeout`.
- `app-theme.ts` / `theme` action — toggle `data-theme` on `<html>`; the magic value `""`/`"neither"` removes the attribute.
- `login.ts` — redirects to `/web/` when the URL contains `login=success`.

## Conventions

- Modules are imperative side-effect scripts, not exported functions — importing one wires up global behavior. Keep that pattern.
- `// @ts-ignore` is used deliberately at DOM-dynamic boundaries (dynamic `window.app` indexing, `target[swap]`, CustomEvent `detail`). Match the surrounding style rather than restructuring for types.
- Behavior is driven by HTML data attributes (`data-url`, `data-theme`, `data-confirm`, `data-timeout`, `data-anchor`) and the `hz-*` / `_*` attribute families. Server templates rely on these names — treat them as a public contract.
- Style is terse: short variable aliases (`let w = window`, `let doc = document`), `let` over `const`, no semicolons in the `.ts` files.
