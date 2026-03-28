# @thomasrumas/llm-client

> CLI client to list, launch, and stop LLM inference servers managed by [`@thomasrumas/llm-manager`](https://www.npmjs.com/package/@thomasrumas/llm-manager) over your local network.

## Requirements

- Node.js 22+
- A machine on your LAN running `@thomasrumas/llm-manager` with the API server available — either:
  - **Daemon (recommended):** `llm-manager service install && llm-manager service start` on the remote machine
  - **Embedded:** API server enabled in the TUI **Settings** (runs while the TUI is open)

## Install

```bash
npm install -g @thomasrumas/llm-client
```

## Quick start

```bash
# 1. Point the client at your manager machine
llm-client config set remote-url http://192.168.1.5:3333

# 2. See what's available
llm-client list

# 3. Launch a model
llm-client start Qwen3-8B

# 4. Check it's running
llm-client status

# 5. Stop it
llm-client stop
```

## Features

- **Zero dependencies** — uses Node's built-in `fetch`, no runtime packages
- **Model name without `.gguf`** — type `Qwen3-8B` instead of `Qwen3-8B-Q4_K_M.gguf`; the extension is added automatically
- **Default model** — configure a default so `llm-client start` always knows what to launch
- **Named configurations** — target any saved config with `--config <name>`
- **10 s request timeout** with a clear "cannot reach server" message

## Commands

### `config`

```bash
llm-client config show
llm-client config set <key> <value>
```

| Key              | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| `remote-url`     | Base URL of the manager API (e.g. `http://192.168.1.5:3333`)         |
| `default-model`  | Model name to use when none is specified on `start`                  |
| `default-config` | Config name to use when `--config` is omitted (default: `"default"`) |

Client config is stored at `~/.local-llm-client/config.json`.

### `list`

```bash
llm-client list
```

Lists every model that has at least one saved configuration on the remote manager, along with their config names. Models without a configuration cannot be launched remotely.

### `start`

```bash
llm-client start [model-name] [--config <name>]
```

Launches a model on the remote manager. If `model-name` is omitted, uses `default-model` from config. The `.gguf` extension is optional — both `Qwen3-8B` and `Qwen3-8B-Q4_K_M.gguf` are accepted.

```bash
llm-client start                          # uses default-model + default config
llm-client start Qwen3-8B                 # specific model, default config
llm-client start Qwen3-8B --config fast   # specific model + named config
```

### `status`

```bash
llm-client status
```

Shows the currently running model (if any): name, config, port, PID, and uptime. Also prints the OpenAI-compatible endpoint URL.

### `stop`

```bash
llm-client stop
```

Stops the model currently running on the remote manager.

### `help`

```bash
llm-client help
```

## How the manager API must be enabled

### Option A — Daemon (recommended for always-on access)

On the remote machine:

```bash
llm-manager service install   # registers with launchd / systemd, starts at login
llm-manager service start     # starts now
```

The daemon runs the API server headlessly with no terminal window required. The TUI can still be used alongside it.

### Option B — Embedded API inside the TUI

On the machine running the manager TUI:

1. Open **Settings** (`4` from the dashboard)
2. Navigate to **API Server** and toggle it **enabled** with `← →`
3. Set the desired **API Port** (default `3333`)
4. Press `Ctrl+S` to save — the API server starts immediately

The API listens on `0.0.0.0` so it is reachable from any device on the same network.

## License

ISC
