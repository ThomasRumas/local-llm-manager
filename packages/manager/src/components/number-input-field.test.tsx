import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { NumberInputField } from './number-input-field.js';

describe('NumberInputField', () => {
  it('renders label and value', () => {
    const { lastFrame } = render(
      <NumberInputField label="Port" value={8001} onChange={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Port:');
    expect(lastFrame()).toContain('8001');
  });

  it('renders without crashing with all props', () => {
    expect(() =>
      render(<NumberInputField label="Port" value={100} onChange={vi.fn()} step={10} min={0} max={1000} />),
    ).not.toThrow();
  });

  it('does not crash on left/right arrow key input', async () => {
    const onChange = vi.fn();
    const instance = render(
      <NumberInputField label="Port" value={100} onChange={onChange} step={10} min={0} max={1000} />,
    );
    instance.stdin.write('\x1B[C'); // Right arrow
    instance.stdin.write('\x1B[D'); // Left arrow
    await new Promise((r) => setTimeout(r, 10));
    expect(instance.lastFrame()).toContain('Port:');
  });
});
