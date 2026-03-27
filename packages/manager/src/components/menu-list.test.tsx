import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MenuList, type MenuItem } from './menu-list.js';

const ITEMS: MenuItem[] = [
  { label: 'Install', value: 'install', shortcut: '1' },
  { label: 'Search', value: 'search', shortcut: '2', description: 'Find models' },
  { label: 'My Models', value: 'my-models', shortcut: '3' },
];

describe('MenuList', () => {
  it('renders all menu items', () => {
    const onSelect = vi.fn();
    const { lastFrame } = render(<MenuList items={ITEMS} onSelect={onSelect} />);
    expect(lastFrame()).toContain('Install');
    expect(lastFrame()).toContain('Search');
    expect(lastFrame()).toContain('My Models');
  });

  it('renders title when provided', () => {
    const { lastFrame } = render(<MenuList items={ITEMS} onSelect={vi.fn()} title="Main Menu" />);
    expect(lastFrame()).toContain('Main Menu');
  });

  it('shows ❯ cursor on first item by default', () => {
    const { lastFrame } = render(<MenuList items={ITEMS} onSelect={vi.fn()} />);
    expect(lastFrame()).toContain('❯');
    const lines = lastFrame()!.split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('Install');
  });

  it('moves selection down on arrow key', async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = render(<MenuList items={ITEMS} onSelect={onSelect} />);
    stdin.write('\x1B[B'); // down arrow
    await vi.waitFor(() => {
      const lines = lastFrame()!.split('\n');
      const cursorLine = lines.find((l) => l.includes('❯'));
      expect(cursorLine).toContain('Search');
    });
  });

  it('calls onSelect with correct item on Enter', () => {
    const onSelect = vi.fn();
    const { stdin } = render(<MenuList items={ITEMS} onSelect={onSelect} />);
    stdin.write('\r'); // Enter
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
  });

  it('calls onSelect with item matching shortcut key', () => {
    const onSelect = vi.fn();
    const { stdin } = render(<MenuList items={ITEMS} onSelect={onSelect} />);
    stdin.write('2');
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
  });

  it('wraps selection from last to first on down arrow', () => {
    const { stdin, lastFrame } = render(<MenuList items={ITEMS} onSelect={vi.fn()} />);
    // Go to last item
    stdin.write('\x1B[B');
    stdin.write('\x1B[B');
    // One more down should wrap to first
    stdin.write('\x1B[B');
    const lines = lastFrame()!.split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('Install');
  });
});
