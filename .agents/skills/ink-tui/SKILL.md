---
name: ink-tui
description: "Build Terminal User Interfaces (TUI) with Ink and React. Use when creating CLI apps, terminal UIs, interactive command-line tools, or working with Ink components, hooks, and layouts. Covers Ink API, Flexbox terminal layouts, keyboard input, focus management, accessibility, and TUI best practices."
argument-hint: "Describe the TUI component or feature to build"
---

# Ink TUI — React for Terminal User Interfaces

Build interactive Terminal User Interfaces using [Ink](https://github.com/vadimdemedes/ink), a React renderer for the terminal. Ink uses Yoga (Flexbox) for layout so CSS-like properties work in the terminal.

## When to Use

- Creating CLI applications with interactive UIs
- Building terminal dashboards, wizards, forms, or menus
- Adding keyboard navigation, focus management, or scrolling to a CLI
- Rendering styled text, tables, progress bars, or spinners in the terminal
- Designing accessible TUI components

## Quick Start

```bash
# Scaffold a new project
npx create-ink-app --typescript my-ink-cli

# Or add to existing project
npm install ink react
```

```tsx
import React, {useState, useEffect} from 'react';
import {render, Text} from 'ink';

const App = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(prev => prev + 1);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return <Text color="green">{count} tests passed</Text>;
};

render(<App />);
```

## Core Concepts

### Mental Model

- Every element is a **Flexbox container** (`display: flex` by default)
- All text **must** be wrapped in `<Text>` — raw strings outside `<Text>` will error
- `<Box>` is `<div style="display: flex">` — it handles layout
- `<Text>` only accepts text nodes and nested `<Text>` — no `<Box>` inside `<Text>`
- The app is a Node.js process: it stays alive only while the event loop has work

### App Lifecycle

```tsx
const {waitUntilExit} = render(<MyApp />);
await waitUntilExit();
console.log('App exited');
```

Exit methods:
- Press **Ctrl+C** (enabled by default via `exitOnCtrlC`)
- Call `exit()` from `useApp()` inside a component
- Call `unmount()` on the render instance

## Procedure

When building an Ink TUI component or application:

1. **Plan the layout** using Flexbox thinking (row/column, spacing, alignment)
2. **Choose components** — see [Components Reference](./references/components.md)
3. **Add interactivity** — see [Hooks Reference](./references/hooks.md)
4. **Follow TUI best practices** — see [Best Practices](./references/best-practices.md)
5. **Test** with `ink-testing-library`
6. **Review** against the TUI checklist below

## TUI Design Checklist

- [ ] All text wrapped in `<Text>` components
- [ ] Layout uses `<Box>` with Flexbox props (not hardcoded spaces)
- [ ] Keyboard input handled via `useInput` (not raw stdin listeners)
- [ ] Focus management uses `useFocus` / `useFocusManager` for multi-element UIs
- [ ] Terminal resize handled via `useWindowSize` for responsive layouts
- [ ] `<Static>` used for completed/log output that shouldn't re-render
- [ ] Graceful exit with `useApp().exit()` and cleanup in `useEffect` returns
- [ ] Accessibility: `aria-role`, `aria-label`, `aria-state` on interactive elements
- [ ] No `console.log` in the render path (use `useStdout().write()` or `<Static>`)
- [ ] Colors use named colors or hex (via chalk under the hood)
- [ ] Borders use `borderStyle` on `<Box>` (single, double, round, bold, classic)

## Key References

- [Components](./references/components.md) — `<Text>`, `<Box>`, `<Newline>`, `<Spacer>`, `<Static>`, `<Transform>`
- [Hooks](./references/hooks.md) — `useInput`, `useFocus`, `useApp`, `useWindowSize`, `useCursor`, etc.
- [Best Practices](./references/best-practices.md) — TUI patterns, performance, accessibility, testing

## Community Components

When you need a component beyond Ink's built-ins (text input, spinner, select, table, progress bar, etc.), search for it on npm or GitHub:

1. **Search npm** for `ink-` prefixed packages: `npm search ink-<feature>` (e.g., `npm search ink-spinner`, `npm search ink-table`)
2. **Search GitHub** for community components: `gh search repos "ink-" --language=typescript --sort=stars`
3. **Check the Ink README** "Useful Components" section at https://github.com/vadimdemedes/ink#useful-components for a curated list
4. **Read the package README** before using — check compatibility with the current Ink version and verify it exports ESM

Most community components follow the `ink-<feature>` naming convention (e.g., `ink-text-input`, `ink-spinner`, `ink-select-input`, `ink-table`).
