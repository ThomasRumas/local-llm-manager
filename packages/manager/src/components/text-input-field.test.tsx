import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { TextInputField } from './text-input-field.js';

// TextInputField uses useFocus — in tests without FocusManager, isFocused is
// always false by default. We wrap in a Box to trigger focus context.

describe('TextInputField', () => {
  it('renders label and value', () => {
    const { lastFrame } = render(
      <TextInputField label="Name" value="hello" onChange={vi.fn()} />,
    );
    expect(lastFrame()).toContain('Name:');
    expect(lastFrame()).toContain('hello');
  });

  it('renders placeholder when value is empty', () => {
    const { lastFrame } = render(
      <TextInputField
        label="Name"
        value=""
        onChange={vi.fn()}
        placeholder="type here"
      />,
    );
    expect(lastFrame()).toContain('type here');
  });

  it('does not render placeholder when value is set', () => {
    const { lastFrame } = render(
      <TextInputField
        label="Name"
        value="test"
        onChange={vi.fn()}
        placeholder="type here"
      />,
    );
    expect(lastFrame()).not.toContain('type here');
  });

  it('does not crash on keyboard input', async () => {
    const onChange = vi.fn();
    const instance = render(
      <TextInputField label="Name" value="hello" onChange={onChange} />,
    );
    instance.stdin.write('a');
    instance.stdin.write('\x7f'); // backspace
    await new Promise((r) => setTimeout(r, 10));
    expect(instance.lastFrame()).toContain('Name:');
  });
});
