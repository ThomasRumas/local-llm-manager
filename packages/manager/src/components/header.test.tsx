import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Header } from './header.js';

describe('Header', () => {
  it('renders default title', () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).toContain('Local LLM Manager');
  });

  it('renders custom title', () => {
    const { lastFrame } = render(<Header title="My Custom App" />);
    expect(lastFrame()).toContain('My Custom App');
  });

  it('renders subtitle when provided', () => {
    const { lastFrame } = render(<Header title="App" subtitle="v1.0.0" />);
    expect(lastFrame()).toContain('v1.0.0');
  });

  it('renders separator line', () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).toContain('─');
  });

  it('does not render subtitle when omitted', () => {
    const { frames } = render(<Header title="App" />);
    const output = frames.join('');
    // Only one content line before the separator (no subtitle line)
    expect(output).not.toContain('undefined');
  });
});
