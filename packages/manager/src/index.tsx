#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { runServiceCli } from './modules/daemon/service.js';

const args = process.argv.slice(2);

if (args[0] === 'service') {
  try {
    await runServiceCli(args.slice(1));
  } catch (err) {
    console.error(`\x1b[31m✖ ${err instanceof Error ? err.message : String(err)}\x1b[0m`);
    process.exit(1);
  }
  process.exit(0);
}

process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H');
process.on('exit', () => {
  process.stdout.write('\x1b[?1049l');
});
render(React.createElement(App));
