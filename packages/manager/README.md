# @thomasrumas/llm-manager

> Interactive TUI to manage llama.cpp — install, search models, configure and monitor `llama-server`.

## Why

Ollama and LM Studio are convenient but ship patched forks of llama.cpp that lag behind upstream and break compatibility with certain GGUF architectures. This manager runs against the **real `llama-server` binary** so every model that llama.cpp supports works here too.

## Requirements

- Node.js 22+
- macOS (Homebrew for the install helper) — Linux support planned
- `llama-server` on `$PATH`, or let the manager install it via Homebrew

## Install

```bash
npm install -g @thomasrumas/llm-manager
```

## Usage

```bash
llm-manager
```

The TUI launches in your terminal. Navigate with arrow keys, confirm with Enter, go back with Esc.

## Features

### Install / Check llama.cpp
- Detects whether `llama-server` is already available on `$PATH`
- Shows the installed version
- Offers a one-key install via `brew install llama.cpp` if it's missing
- Streams Homebrew output live

### Search & Download Models (Hugging Face)
- Full-text search against the Hugging Face Hub
- Filters results to GGUF-format files only
- Shows quantization level, file size, and download count per file
- Live download progress bar
- Authenticates with your HF token for gated models

### My Models
- Scans your configured models directory for `.gguf` files
- Shows file size, last modified date, and whether a configuration is saved
- Actions per model: **Launch**, **Configure**, **Delete**

### Configure & Launch
Configure any `llama-server` flag through a form — no flag memorisation needed:

| Parameter | Flag | Default |
|-----------|------|---------|
| Alias | `--alias` | model filename |
| Temperature | `--temp` | `0.6` |
| Top-P | `--top-p` | `0.95` |
| Top-K | `--top-k` | `20` |
| Min-P | `--min-p` | `0.0` |
| Port | `--port` | `8001` |
| Context size | `--ctx-size` | `131072` |
| KV Unified | `--kv-unified` | on |
| Cache type K/V | `--cache-type-k/v` | `q8_0` |
| Flash Attention | `--flash-attn` | on |
| FIT | `--fit` | on |
| Extra flags | _(raw text appended)_ | — |

Multiple named configurations per model (e.g. `default`, `quality`, `fast`). Resolution order: model config → global defaults → hardcoded fallback.

### Server Monitor
- Live CPU %, RAM, VRAM, process-level CPU and RAM
- Scrollable log output streamed directly from `llama-server` stdout/stderr
- Start / stop the server without leaving the TUI

### REST API Server _(optional)_
Enable an embedded HTTP API in **Settings** to let the [`@thomasrumas/llm-client`](https://www.npmjs.com/package/@thomasrumas/llm-client) control the manager from another machine on your local network.

| Endpoint | Description |
|----------|-------------|
| `GET /api/models` | List models that have a saved configuration |
| `POST /api/models/:filename/start` | Launch a model (`{ config?: string }`) |
| `GET /api/status` | Running server state |
| `POST /api/stop` | Stop the running model |

Binds to `0.0.0.0` so it is reachable on your LAN. Disabled by default.

### Settings
- Models directory (default `~/.local-llm-manager/models/`)
- Global defaults for port and context size
- Hugging Face token
- API server toggle + port

## Configuration file

Stored at `~/.local-llm-manager/config.json`:

```jsonc
{
  "modelsDirectory": "~/.local-llm-manager/models",
  "defaults": { "port": 8001, "ctxSize": 131072 },
  "apiServer": { "enabled": false, "port": 3333 },
  "configurations": {
    "Qwen3-8B-Q4_K_M.gguf": {
      "default": { "alias": "Qwen3-8B", "temp": 0.6, "topP": 0.95 }
    }
  }
}
```

## Keyboard reference

| Key | Action |
|-----|--------|
| `↑ ↓` | Navigate / scroll |
| `← →` | Adjust value / toggle |
| `Enter` | Select / confirm |
| `Esc` | Back |
| `Ctrl+S` | Save |
| `Ctrl+L` | Save & Launch |
| `1`–`4` | Dashboard shortcuts |
| `q` | Quit |

## License

ISC
