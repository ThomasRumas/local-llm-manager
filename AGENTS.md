# Local LLM Manager

A Terminal User Interface (TUI) built with **Ink** (React) and **TypeScript** to manage local LLM inference through **llama.cpp**.

## Purpose

Provide a single interactive CLI to install llama.cpp, discover and download models from Hugging Face, configure inference parameters, and launch `llama-server` — all without memorizing commands or flags.

## Tech Stack

| Layer          | Technology                                                        |
| -------------- | ----------------------------------------------------------------- |
| Runtime        | Node.js 22+ (ESM)                                                 |
| UI Framework   | Ink 6 + React 19                                                  |
| Language       | TypeScript                                                        |
| LLM Backend    | llama.cpp (`llama-server`) installed via Homebrew                 |
| Model Registry | Hugging Face Hub (via `@huggingface/hub`)                         |
| Config Storage | JSON file on disk (`~/.local-llm-manager/config.json` by default) |

## Features

### 1. Install llama.cpp

- Detect if `llama-server` is already available on `$PATH` (via `which llama-server`)
- If missing, offer to install via Homebrew: `brew install llama.cpp`
- Verify installation succeeded and display the installed version
- Reference: https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md

### 2. Search Models on Hugging Face

- Use `@huggingface/hub` to search for models: https://huggingface.co/docs/huggingface.js/hub/modules
- Filter by GGUF format files (the format llama.cpp uses)
- Display results in a navigable list with: model name, size, quantization level, downloads count
- Allow the user to select a model and download it to the configured models directory
- Show download progress

### 3. List Downloaded Models

- Scan the configured models directory for `.gguf` files
- Display each model with: filename, file size, last used date, whether it has a saved configuration
- Allow selecting a model to launch, configure, or delete

### 4. Configure Model Launch Parameters

When launching a model, allow the user to configure `llama-server` flags through a form UI:

| Parameter       | Flag             | Default        | Description                                                           |
| --------------- | ---------------- | -------------- | --------------------------------------------------------------------- |
| Alias           | `--alias`        | model name     | Display name for the model                                            |
| Temperature     | `--temp`         | `0.6`          | Sampling temperature                                                  |
| Top-P           | `--top-p`        | `0.95`         | Nucleus sampling threshold                                            |
| Top-K           | `--top-k`        | `20`           | Top-K sampling                                                        |
| Min-P           | `--min-p`        | `0.0`          | Minimum probability threshold                                         |
| Port            | `--port`         | global default | HTTP server port (global default, overridable per model)              |
| Context Size    | `--ctx-size`     | global default | Context window size in tokens (global default, overridable per model) |
| KV Unified      | `--kv-unified`   | `true`         | Unified KV cache                                                      |
| Cache Type K    | `--cache-type-k` | `q8_0`         | Key cache quantization                                                |
| Cache Type V    | `--cache-type-v` | `q8_0`         | Value cache quantization                                              |
| Flash Attention | `--flash-attn`   | `on`           | Enable flash attention                                                |
| FIT             | `--fit`          | `on`           | Enable FIT                                                            |

The form should also support adding arbitrary extra flags as raw text for advanced users.

### 5. Save Model Configurations

- When the user configures and launches a model, persist the configuration
- Next time the same model is selected, pre-fill the form with the saved values
- Allow multiple named configurations per model (e.g., "fast", "quality", "coding")
- Store configurations in the config file alongside global settings

### 6. Configure Models Directory

- Allow the user to set where `.gguf` model files are stored
- Default: `~/.local-llm-manager/models/`
- Persist this setting in the config file
- Create the directory if it doesn't exist

### 7. Daemon / Background Service

- Run the REST API server as a persistent background service with no terminal window required
- Platform support: **launchd** on macOS (`~/Library/LaunchAgents/com.local-llm-manager.daemon.plist`), **systemd** (user-level) on Linux
- No `sudo` required — both service managers operate at user level
- Service commands available both from the CLI (`llm-manager service <subcommand>`) and from the **Service** screen in the TUI
- Subcommands: `install`, `uninstall`, `start`, `stop`, `status`, `logs`
- Double-start prevention via a PID file (`~/.local-llm-manager/manager.pid`)
- The daemon runs only the API server — it does **not** auto-launch a model
- The TUI detects a running daemon on startup (`EADDRINUSE`) and continues normally without trying to start a second API server
- The TUI header bar shows live service status: `not installed` / `stopped` / `running` (with PID), polled every 5 s
- The service status is shared via `ServiceStatusProvider` context so both the header and the Service screen share a single polling instance

**Daemon entry point** (`src/daemon.ts` → `dist/daemon.js`, binary `llm-manager-daemon`):
1. `checkExistingDaemon()` — exits if PID file is alive
2. `configService.load()`
3. `writePid(process.pid)`
4. `apiServer.start(config.apiServer.port)`
5. SIGTERM/SIGINT → `apiServer.stop()` + `removePid()`

**Module layout** (`src/modules/daemon/`):
- `pid-file.ts` — write / read / remove PID file, stale-file cleanup
- `service.ts` — OS service templates, install/uninstall/start/stop/status/logs, `runServiceCli()` command handler

**launchd plist extras**: `EnvironmentVariables.PATH` includes `/opt/homebrew/bin` so `llama-server` resolves correctly in the minimal launchd environment.

## Config File Structure

```jsonc
// ~/.local-llm-manager/config.json
{
  "modelsDirectory": "~/.local-llm-manager/models",
  "defaults": {
    "port": 8001,
    "ctxSize": 131072,
  },
  "apiServer": {
    "enabled": false,
    "port": 3333,
  },
  "configurations": {
    "Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf": {
      "default": {
        "alias": "unsloth/Qwen3.5-35B-A3B",
        "temp": 0.6,
        "topP": 0.95,
        "topK": 20,
        "minP": 0.0,
        // "port" and "ctxSize" omitted → inherited from defaults
        // uncomment below to override for this model:
        // "port": 9000,
        // "ctxSize": 65536,
        "kvUnified": true,
        "cacheTypeK": "q8_0",
        "cacheTypeV": "q8_0",
        "flashAttn": "on",
        "fit": "on",
        "extraFlags": "",
      },
    },
  },
}
```

Resolution order: **model configuration → global defaults → hardcoded fallback**. When launching, the form pre-fills port and context size from the global defaults, but the user can override them per model. If overridden, the value is saved in the model configuration; if left at the default, it is omitted to keep configs clean.

## TUI Navigation

```
┌─────────────────────────────────────────┐
│  Local LLM Manager                      │
├─────────────────────────────────────────┤
│                                         │
│  [1] Install / Check llama.cpp          │
│  [2] Search Models (Hugging Face)       │
│  [3] My Models (downloaded)             │
│  [4] Settings                           │
│  [5] Service                            │
│  [q] Quit                               │
│                                         │
└─────────────────────────────────────────┘
```

- **Install / Check**: Shows install status, version, offers install if missing
- **Search Models**: Text input to search HF → results list → download action
- **My Models**: List of local `.gguf` files → select to launch/configure/delete
- **Settings**: Configure models directory, global defaults (port, context size), and other preferences
- **Service**: Show OS service status (not installed / stopped / running + PID); install, start, stop, uninstall

## Conventions

- Use `ink` built-in components (`<Box>`, `<Text>`, `<Static>`) for layout
- Use `useInput` for keyboard navigation, `useFocus` for form fields
- Use `useWindowSize` for responsive layout
- All text must be wrapped in `<Text>`
- Use `<Static>` for log output (download progress, server stdout)
- Handle `Ctrl+C` gracefully — stop running servers before exit
- Use `child_process.spawn` to run `llama-server` and stream its output
- ESM-only (`"type": "module"` in package.json)
- Strict TypeScript
- TypeScript backend follows a NestJS-inspired modular system
- Use `ServiceStatusProvider` context at the `App` level so service status is polled once and shared across the header bar and the Service screen — never call `useServiceStatus()` directly inside components; use `useServiceStatusContext()` instead
- Prefer explicit `null` checks over `&&` for `string | null` values in JSX to avoid falsy-render bugs (`rendering-conditional-render`)
- Mk `setState` calls inside `useEffect` bodies async-only (no synchronous setState directly in the effect body) to satisfy `react-hooks/set-state-in-effect`
