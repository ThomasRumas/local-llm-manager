import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ProgressBar } from './progress-bar.js';

describe('ProgressBar', () => {
  it('renders 0% with all empty blocks', () => {
    const { lastFrame } = render(<ProgressBar percent={0} width={10} />);
    expect(lastFrame()).toContain('0.0%');
    expect(lastFrame()).not.toContain('█');
  });

  it('renders 100% with all filled blocks', () => {
    const { lastFrame } = render(<ProgressBar percent={100} width={10} />);
    expect(lastFrame()).toContain('100.0%');
    expect(lastFrame()).not.toContain('░');
  });

  it('renders 50% with half filled', () => {
    const { lastFrame } = render(<ProgressBar percent={50} width={10} />);
    expect(lastFrame()).toContain('50.0%');
    expect(lastFrame()).toContain('█');
    expect(lastFrame()).toContain('░');
  });

  it('renders optional label', () => {
    const { lastFrame } = render(<ProgressBar percent={25} label="Downloading" />);
    expect(lastFrame()).toContain('Downloading');
  });

  it('clamps values above 100', () => {
    const { lastFrame } = render(<ProgressBar percent={150} width={10} />);
    expect(lastFrame()).toContain('100.0%');
  });

  it('clamps values below 0', () => {
    const { lastFrame } = render(<ProgressBar percent={-10} width={10} />);
    expect(lastFrame()).toContain('0.0%');
  });
});
