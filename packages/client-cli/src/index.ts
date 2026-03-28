#!/usr/bin/env node
import { loadConfig, setConfigValue } from './config.js';
import { listModels, startModel, getStatus, stopModel } from './client.js';

// ─── ANSI colours ────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function bold(s: string) {
  return `${c.bold}${s}${c.reset}`;
}
function cyan(s: string) {
  return `${c.cyan}${s}${c.reset}`;
}
function green(s: string) {
  return `${c.green}${s}${c.reset}`;
}
function yellow(s: string) {
  return `${c.yellow}${s}${c.reset}`;
}
function red(s: string) {
  return `${c.red}${s}${c.reset}`;
}
function gray(s: string) {
  return `${c.gray}${s}${c.reset}`;
}
function dim(s: string) {
  return `${c.dim}${s}${c.reset}`;
}

function displayModelName(filename: string): string {
  return filename.replace(/\.gguf$/, '');
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── Help ────────────────────────────────────────────────────────────────────
function printHelp() {
  console.log(`
${bold('llm-client')} — Remote LLM manager client

${bold('Usage:')}
  llm-client ${cyan('<command>')} [options]

${bold('Commands:')}
  ${cyan('config show')}                        Show current client configuration
  ${cyan('config set')} ${yellow('<key>')} ${yellow('<value>')}            Set a config value

    Keys:
      ${yellow('remote-url')}      API server base URL  (e.g. http://192.168.1.5:3333)
      ${yellow('default-model')}   Default model name or alias to launch
      ${yellow('default-config')}  Default config name            (default: "default")

  ${cyan('list')}                               List configured models on the remote server
  ${cyan('start')} [model] [--config <name>]    Start a model by name or alias (uses default-model if omitted)
  ${cyan('status')}                             Show running model status
  ${cyan('stop')}                               Stop the running model
  ${cyan('help')}                               Show this help

${bold('Examples:')}
  llm-client config set remote-url http://192.168.1.5:3333
  llm-client config set default-model Qwen3.5-35B
  llm-client list
  llm-client start
  llm-client start Qwen3.5-35B --config quality
  llm-client status
  llm-client stop
`);

}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdConfigShow() {
  const config = await loadConfig();
  console.log(`\n${bold('Client Configuration')}`);
  console.log(`  ${cyan('remote-url')}      ${config.remoteUrl}`);
  console.log(
    `  ${cyan('default-model')}   ${config.defaultModel ?? gray('(not set)')}`,
  );
  console.log(
    `  ${cyan('default-config')}  ${config.defaultConfig ?? gray('default')}\n`,
  );
}

async function cmdConfigSet(args: string[]) {
  const [keyRaw, value] = args;
  if (!keyRaw || value === undefined) {
    console.error(red('Usage: llm-client config set <key> <value>'));
    process.exit(1);
  }

  const keyMap: Record<string, 'remoteUrl' | 'defaultModel' | 'defaultConfig'> =
    {
      'remote-url': 'remoteUrl',
      'default-model': 'defaultModel',
      'default-config': 'defaultConfig',
    };

  const key = keyMap[keyRaw];
  if (!key) {
    console.error(red(`Unknown config key: ${keyRaw}`));
    console.error(`  Valid keys: ${Object.keys(keyMap).join(', ')}`);
    process.exit(1);
  }

  const normalizedValue = value;
  await setConfigValue(key, normalizedValue);
  console.log(
    `${green('\u2714')} Set ${cyan(keyRaw)} = ${yellow(normalizedValue)}`,
  );
}

async function cmdList() {
  const config = await loadConfig();
  let data;
  try {
    data = await listModels(config.remoteUrl);
  } catch (err) {
    console.error(red(`✖ ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  if (!data || data.models.length === 0) {
    console.log(yellow('No configured models found on the remote server.'));
    console.log(dim('  Configure a model via the manager TUI first.'));
    return;
  }

  const remoteLabel = gray(`(${config.remoteUrl})`);
  console.log(`\n${bold('Available Models')} ${remoteLabel}\n`);
  for (const model of data.models) {
    // Match by filename, filename without .gguf, or any config alias
    const modelDisplay = displayModelName(model.filename);
    const defaultVal = config.defaultModel ?? '';
    const isDefault =
      defaultVal === model.filename ||
      defaultVal === modelDisplay ||
      model.configs.some((c) => c.alias === defaultVal);

    // Use the alias from the default config if available, otherwise fallback to stripped filename
    const defaultCfg =
      model.configs.find((c) => c.name === 'default') ?? model.configs[0];
    const displayName = defaultCfg?.alias ?? modelDisplay;

    console.log(`  ${isDefault ? green('\u276f') : ' '} ${cyan(displayName)}`);
    if (defaultCfg?.alias) {
      console.log(`      ${gray('file:')} ${gray(modelDisplay)}`);
    }
    const configLabels = model.configs
      .map((c) => {
        if (!c.alias) return yellow(c.name);
        const aliasLabel = gray(`(${c.alias})`);
        return `${yellow(c.name)} ${aliasLabel}`;
      })
      .join(', ');
    console.log(`      configs: ${configLabels}`);
  }
  console.log('');
}

async function cmdStart(args: string[]) {
  const config = await loadConfig();

  // Parse --config flag
  let configName = config.defaultConfig ?? 'default';
  const remaining: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      configName = args[i + 1];
      i++;
    } else {
      remaining.push(args[i]);
    }
  }

  const modelArg = remaining[0] ?? config.defaultModel;

  if (!modelArg) {
    console.error(red('✖ No model specified and no default-model configured.'));
    console.error(
      `  Use: ${cyan('llm-client config set default-model <name>')}`,
    );
    console.error(`   or: ${cyan('llm-client start <model-name>')}`);
    process.exit(1);
  }

  // Pass identifier as-is; the server resolves: exact filename → filename.gguf → alias
  const modelIdentifier = modelArg;
  const displayLabel = modelIdentifier.replace(/\.gguf$/, '');
  const configLabel = dim(`(config: ${configName})`);
  const remoteStartLabel = dim(`on ${config.remoteUrl}...`);
  console.log(
    `${dim('Starting')} ${cyan(displayLabel)} ${configLabel} ${remoteStartLabel}`,
  );

  let result;
  try {
    result = await startModel(config.remoteUrl, modelIdentifier, configName);
  } catch (err) {
    console.error(red(`✖ ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  if (!result) {
    console.error(red('✖ No response from server'));
    process.exit(1);
  }
  console.log(`${green('✔')} Model started`);
  console.log(`  ${cyan('port')}  ${result.port}`);
  console.log(`  ${cyan('pid')}   ${result.pid}`);
  console.log(`  ${cyan('url')}   http://<host>:${result.port}/v1`);
}

async function cmdStatus() {
  const config = await loadConfig();
  let status;
  try {
    status = await getStatus(config.remoteUrl);
  } catch (err) {
    console.error(red(`✖ ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  const statusLabel = gray(`(${config.remoteUrl})`);
  console.log(`\n${bold('Server Status')} ${statusLabel}`);

  if (!status.running) {
    console.log(`  ${gray('●')} Not running\n`);
    return;
  }

  console.log(`  ${green('●')} Running`);
  console.log(
    `  ${cyan('model')}    ${status.modelFile ? displayModelName(status.modelFile) : '—'}`,
  );
  console.log(`  ${cyan('config')}   ${status.configName ?? '—'}`);
  console.log(`  ${cyan('port')}     ${status.port ?? '—'}`);
  console.log(`  ${cyan('pid')}      ${status.pid ?? '—'}`);
  console.log(`  ${cyan('uptime')}   ${formatUptime(status.uptimeSeconds)}`);
  if (status.port) {
    console.log(`  ${cyan('url')}      http://<host>:${status.port}/v1`);
  }
  if (status.error) {
    console.log(`  ${red('error')}    ${status.error}`);
  }
  console.log('');
}

async function cmdStop() {
  const config = await loadConfig();
  let result;
  try {
    result = await stopModel(config.remoteUrl);
  } catch (err) {
    console.error(red(`✖ ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
  if (result.success) {
    console.log(`${green('✔')} Model stopped`);
  } else {
    console.error(red('✖ Failed to stop model'));
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (
    !command ||
    command === 'help' ||
    command === '--help' ||
    command === '-h'
  ) {
    printHelp();
    return;
  }

  if (command === 'config') {
    const sub = args[1];
    if (sub === 'show') {
      await cmdConfigShow();
    } else if (sub === 'set') {
      await cmdConfigSet(args.slice(2));
    } else {
      console.error(red(`Unknown config sub-command: ${sub ?? ''}`));
      console.error(
        `  Use: ${cyan('llm-client config show')} or ${cyan('llm-client config set <key> <value>')}`,
      );
      process.exit(1);
    }
    return;
  }

  if (command === 'list') {
    await cmdList();
    return;
  }

  if (command === 'start') {
    await cmdStart(args.slice(1));
    return;
  }

  if (command === 'status') {
    await cmdStatus();
    return;
  }

  if (command === 'stop') {
    await cmdStop();
    return;
  }

  console.error(red(`Unknown command: ${command}`));
  console.error(`  Run ${cyan('llm-client help')} for usage.`);
  process.exit(1);
}

try {
  await main();
} catch (err) {
  console.error(
    red(
      `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    ),
  );
  process.exit(1);
}
