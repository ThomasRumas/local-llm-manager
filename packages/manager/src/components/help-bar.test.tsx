import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { HelpBar } from './help-bar.js';

describe('HelpBar', () => {
  it('renders all item keys and labels', () => {
    const items = [
      { key: 'q', label: 'quit' },
      { key: '↑↓', label: 'navigate' },
    ];
    const { lastFrame } = render(<HelpBar items={items} />);
    expect(lastFrame()).toContain('q');
    expect(lastFrame()).toContain('quit');
    expect(lastFrame()).toContain('↑↓');
    expect(lastFrame()).toContain('navigate');
  });

  it('renders with a single item', () => {
    const { lastFrame } = render(<HelpBar items={[{ key: 'esc', label: 'back' }]} />);
    expect(lastFrame()).toContain('esc');
    expect(lastFrame()).toContain('back');
  });

  it('renders empty items without crashing', () => {
    expect(() => render(<HelpBar items={[]} />)).not.toThrow();
  });
});
