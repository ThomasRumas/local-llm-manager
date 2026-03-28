# Contributing to Local LLM Manager

## Table of contents

- [Project overview](#project-overview)
- [Repository structure](#repository-structure)
- [Architecture](#architecture)
- [Development setup](#development-setup)
- [Running the project locally](#running-the-project-locally)
- [Testing with npm link](#testing-with-npm-link)
- [Tests](#tests)
- [Code style](#code-style)
- [Submitting a PR](#submitting-a-pr)

---

## Project overview

This is a **npm workspaces monorepo** with two packages:

| Package | Binary | Role |
|---------|--------|------|
| `packages/manager` | `llm-manager`, `llm-manager-daemon` | Interactive Ink TUI + background daemon |
| `packages/client-cli` | `llm-client` | Thin REST CLI client for remote control |

Both packages are **ESM-only** TypeScript compiled with `tsc`. No bundler.

---

## Repository structure

```
local-llm-manager/
├── packages/
│   ├── manager/
│   │   ├── src/
│   │   │   ├── app.tsx              # Ink app shell (screen router, providers)
│   │   │   ├── index.tsx            # Entry point: service CLI intercept → TUI
│   │   │   ├── daemon.ts            # Headless entry point for llm-manager-daemon
│   │   │   ├── components/          # Reusable Ink components (Header, StatusBadge, …)
│   │   │   ├── contexts/            # React contexts (ServerContext, ServiceStatusContext)
│   │   │   ├── hooks/               # Custom hooks (useScreen, useAsync, useServiceStatus, …)
│   │   │   ├── screens/             # Full-screen views (Dashboard, MyModels, ServiceManager, …)
│   │   │   └── modules/
│   │   │       ├── api/             # HTTP API server (Express-like, no framework)
│   │   │       ├── config/          # Config file read/write (~/.local-llm-manager/config.json)
│   │   │       ├── daemon/          # PID file + OS service management (launchd / systemd)
│   │   │       ├── huggingface/     # HF Hub search + download
│   │   │       ├── llama/           # llama-server detect / install / launch
│   │   │       ├── models/          # Local .gguf file scanning
│   │   │       ├── server/          # ServerManager: lifecycle of the llama-server process
│   │   │       └── system/          # System stats (CPU, RAM, VRAM)
│   │   └── dist/                    # Compiled output (git-ignored)
│   └── client-cli/
│       ├── src/
│       │   ├── index.ts             # CLI entry point + command routing
│       │   ├── client.ts            # HTTP client (fetch wrapper)
│       │   └── config.ts            # Client config (~/.local-llm-client/config.json)
│       └── dist/
├── eslint.config.mjs
├── package.json                     # Root: workspace scripts, shared dev deps
└── tsconfig.json                    # Root tsconfig (referenced by packages)
```

---

## Architecture

### TUI entry point (`index.tsx`)

Reads `process.argv`. If the first argument is `service`, it calls `runServiceCli()` and exits — no React involved. Everything else falls through to `render(<App />)`.

### App shell (`app.tsx`)

Loads config, starts the optional embedded API server, sets up providers, and routes between screens via `useScreen`.

### Providers

| Provider | Where | What it shares |
|----------|-------|----------------|
| `ServerProvider` | `App` | `llama-server` process state + start/stop |
| `ServiceStatusProvider` | `App` | OS service status (installed / running / PID), polling every 5 s |

Both run at the top of the tree so all screens and the header bar share a single polling instance.

### Daemon mode (`daemon.ts`)

Separate Node.js entry point compiled to `dist/daemon.js`. No React/Ink. Flow:

1. `checkExistingDaemon()` — refuse to start if PID file is alive
2. `configService.load()`
3. `writePid(process.pid)`
4. `apiServer.start(port)`
5. SIGTERM/SIGINT → `apiServer.stop()` + `removePid()`

### Service management (`modules/daemon/`)

- `pid-file.ts` — write / read / remove `~/.local-llm-manager/manager.pid`, stale-file cleanup
- `service.ts` — generate and install launchd plist (macOS) or systemd unit (Linux), start/stop/status/logs, `runServiceCli()` command handler

---

## Development setup

**Prerequisites:** Node.js 22+, npm 10+

```bash
git clone https://github.com/your-org/local-llm-manager
cd local-llm-manager
npm install          # installs deps for all workspaces
```

Build both packages:

```bash
npm run build
```

Or watch-mode for one package while developing:

```bash
# In one terminal — recompile manager on save
npm run dev:manager

# In another terminal — run the TUI against the compiled output
npm run start:manager
```

---

## Running the project locally

```bash
# Run the TUI directly from source (after build)
node packages/manager/dist/index.js

# Run the daemon entry point
node packages/manager/dist/daemon.js

# Run the client CLI
node packages/client-cli/dist/index.js list
```

---

## Testing with npm link

`npm link` exposes the locally built binaries (`llm-manager`, `llm-manager-daemon`, `llm-client`) on your `$PATH` exactly as if they were installed from npm — the safest way to verify the full end-to-end flow before opening a PR.

### Link both packages

```bash
# Build first
npm run build

# Register llm-manager + llm-manager-daemon globally
cd packages/manager
npm link
cd ../..

# Register llm-client globally
cd packages/client-cli
npm link
cd ../..
```

Verify:

```bash
which llm-manager          # should resolve to your local dist/
llm-manager --version      # or just run it to see the TUI
which llm-client
llm-client help
```

### Typical end-to-end test flow

```bash
# 1. Launch the TUI
llm-manager

# 2. Install the daemon service
llm-manager service install
llm-manager service start
llm-manager service status     # should show "running"

# 3. Test remote control from the client
llm-client config set remote-url http://localhost:3333
llm-client list
llm-client status

# 4. Tear down
llm-manager service stop
llm-manager service uninstall
```

### Rebuild and re-test after changes

`npm link` points directly at `dist/`, so a rebuild is all you need — no re-link required:

```bash
npm run build && llm-manager
```

### Unlink when done

```bash
cd packages/manager   && npm unlink
cd ../client-cli      && npm unlink
```

---

## Tests

```bash
# Run all tests
npm test

# Run with coverage (must meet 80 % thresholds — CI enforces this)
npm run test:coverage

# Watch mode for a single package
cd packages/manager && npm run test:watch
```

### Test conventions

- Framework: **Vitest** + `ink-testing-library` for Ink components
- Test files live alongside source: `foo.ts` → `foo.test.ts` / `foo.test.tsx`
- Ink component tests rendered with `ink-testing-library`'s `render()`, always unmounted in `afterEach` to prevent handler bleed between tests
- Hooks tested via thin wrapper components rendered with `render()`
- All external I/O mocked with `vi.mock()` — no real filesystem, network, or child-process calls in unit tests
- OS service commands (`launchctl`, `systemctl`, `execFileAsync`) mocked at the module boundary

---

## Code style

```bash
npm run lint          # ESLint (react-hooks rules enforced)
npm run lint:fix      # Auto-fix
npm run format        # Prettier
npm run format:check  # CI check
```

**Key rules enforced by ESLint:**

- `react-hooks/set-state-in-effect` — no synchronous `setState` directly in effect bodies
- `react-hooks/globals` — no assigning to variables declared outside components during render
- All text in Ink components must be wrapped in `<Text>`

---

## Submitting a PR

1. **Branch** off `main`: `git checkout -b feat/my-feature`
2. **Build** and fix any TypeScript errors: `npm run build`
3. **Test** your changes end-to-end with `npm link` (see above)
4. **Run the full test suite**: `npm test` — all tests must pass
5. **Check coverage**: `npm run test:coverage` — branches and lines must stay above 80 %
6. **Lint + format**: `npm run lint && npm run format:check`
7. **Update documentation** if you added a feature:
   - `AGENTS.md` — agent context file, keep in sync with feature set
   - `packages/manager/README.md` — user-facing manager docs
   - `packages/client-cli/README.md` — user-facing client docs
   - `README.md` — root overview
8. **Open the PR** — CI runs build, lint, format check, and tests with coverage automatically

### CI checks (must all pass)

| Check | Command |
|-------|---------|
| Build | `npm run build` |
| Lint | `npm run lint` |
| Format | `npm run format:check` |
| Tests | `npm test` |
| Coverage | `npm run test:coverage` (80 % branches + lines) |
