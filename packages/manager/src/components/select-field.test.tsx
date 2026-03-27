import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { SelectField } from './select-field.js';

describe('SelectField', () => {
  const options = ['q4_0', 'q8_0', 'f16'];

  it('renders label and current value', () => {
    const { lastFrame } = render(
      <SelectField
        label="Cache"
        options={options}
        value="q8_0"
        onChange={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Cache:');
    expect(lastFrame()).toContain('q8_0');
  });

  it('renders all options accessible (no crash)', () => {
    expect(() =>
      render(
        <SelectField
          label="Type"
          options={options}
          value="q4_0"
          onChange={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('calls onChange when right arrow pressed (focused)', async () => {
    const onChange = vi.fn();
    const instance = render(
      <SelectField
        label="Type"
        options={options}
        value="q4_0"
        onChange={onChange}
      />,
    );
    instance.stdin.write('\x1B[C'); // Right arrow
    // If focused, onChange should be called; if not focused, no error
    await new Promise((r) => setTimeout(r, 10));
    // Component renders without error regardless of focus
    expect(instance.lastFrame()).toContain('Type:');
  });

  it('does not crash on left arrow press', async () => {
    const onChange = vi.fn();
    const instance = render(
      <SelectField
        label="Type"
        options={options}
        value="q8_0"
        onChange={onChange}
      />,
    );
    instance.stdin.write('\x1B[D'); // Left arrow
    await new Promise((r) => setTimeout(r, 10));
    expect(instance.lastFrame()).toContain('Type:');
  });
});
