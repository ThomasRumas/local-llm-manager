import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBadge } from './status-badge.js';

describe('StatusBadge', () => {
  it('renders success with ✔ icon', () => {
    const { lastFrame } = render(<StatusBadge status="success" label="Done" />);
    expect(lastFrame()).toContain('✔');
    expect(lastFrame()).toContain('Done');
  });

  it('renders error with ✖ icon', () => {
    const { lastFrame } = render(<StatusBadge status="error" label="Failed" />);
    expect(lastFrame()).toContain('✖');
    expect(lastFrame()).toContain('Failed');
  });

  it('renders warning with ⚠ icon', () => {
    const { lastFrame } = render(<StatusBadge status="warning" label="Watch out" />);
    expect(lastFrame()).toContain('⚠');
  });

  it('renders info with ℹ icon', () => {
    const { lastFrame } = render(<StatusBadge status="info" label="Note" />);
    expect(lastFrame()).toContain('ℹ');
  });

  it('renders loading with ⟳ icon', () => {
    const { lastFrame } = render(<StatusBadge status="loading" label="Working…" />);
    expect(lastFrame()).toContain('⟳');
    expect(lastFrame()).toContain('Working…');
  });
});
