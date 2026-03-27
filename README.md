# Local LLM Manager

> A TUI to run llama.cpp the simple way.

## Why this project exists

Tools like **Ollama** and **LM Studio** are great — they are polished, easy to use, and abstract away most of the complexity of running local LLMs. But they both ship with their own fork of **llama.cpp**, and that fork doesn't always keep up with upstream. The result is that certain GGUF model architectures — especially newer quants or exotic architectures — simply don't work, or produce incorrect output.

**llama.cpp itself** supports everything. It's the reference implementation. The problem is that running it directly means memorising a wall of CLI flags, managing processes by hand, and having no decent way to save or switch between configurations.

Local LLM Manager bridges that gap: it gives you a **terminal user interface** on top of the real, unmodified `llama-server` binary, so you get full GGUF compatibility with none of the flag-memorisation. Think of it as the settings panel that llama.cpp never had.

---

## Packages

This is a monorepo with two packages:

| Package | npm | Description |
|---------|-----|-------------|
| [`@thomasrumas/llm-manager`](./packages/manager) | [![npm](https://img.shields.io/npm/v/@thomasrumas/llm-manager)](https://www.npmjs.com/package/@thomasrumas/llm-manager) | Interactive TUI — install llama.cpp, search & download models, configure and launch `llama-server`, monitor it in real time |
| [`@thomasrumas/llm-client`](./packages/client-cli) | [![npm](https://img.shields.io/npm/v/@thomasrumas/llm-client)](https://www.npmjs.com/package/@thomasrumas/llm-client) | Thin CLI client — launch and control models running on a remote machine over your local network |

---

## Requirements

- **Node.js 22+** (ESM, native `fetch`)
- **macOS** (Linux support planned — the only macOS-only part is the Homebrew install helper)
- **Homebrew** — only needed if you want the manager to install `llama.cpp` for you

---

## Quick start

```bash
# Install the manager globally
npm install -g @thomasrumas/llm-manager

# Launch the TUI
llm-manager
```

```bash
# On a different machine, install the client
npm install -g @thomasrumas/llm-client

# Point it at the manager's API server
llm-client config set remote-url http://192.168.1.5:3333
llm-client list
llm-client start Qwen3-8B
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  @local-llm-manager/manager  (TUI)          │
│                                             │
│  ┌────────────┐   ┌─────────────────────┐  │
│  │  Ink / React│   │  REST API  :3333    │  │
│  │  interface  │   │  (optional, toggle) │  │
│  └─────┬──────┘   └──────────┬──────────┘  │
│        │                     │              │
│        └──────────┬──────────┘              │
│                   │                         │
│          ServerManager (singleton)          │
│                   │                         │
│            llama-server (child process)     │
└─────────────────────────────────────────────┘
                    ▲
                    │  HTTP
┌───────────────────┴────────────────────────┐
│  @local-llm-manager/client  (CLI)          │
│  llm-client start / status / stop …        │
└────────────────────────────────────────────┘
```

---

## Contributing

```bash
git clone https://github.com/your-org/local-llm-manager
cd local-llm-manager
npm install          # installs all workspace dependencies
npm run build        # builds both packages
npm run start:manager
```

---

## License

ISC
