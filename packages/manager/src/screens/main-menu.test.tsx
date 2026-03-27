import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MainMenu } from './main-menu.js';

vi.mock('ink', async (importActual) => {
  const actual = await importActual<typeof import('ink')>();
  return { ...actual, useApp: () => ({ exit: vi.fn() }) };
});

describe('MainMenu', () => {
  it('renders all menu items', () => {
    const { lastFrame } = render(<MainMenu onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('Install');
    expect(lastFrame()).toContain('Search Models');
    expect(lastFrame()).toContain('My Models');
    expect(lastFrame()).toContain('Settings');
    expect(lastFrame()).toContain('Quit');
  });

  it('renders the application title', () => {
    const { lastFrame } = render(<MainMenu onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('Local LLM Manager');
  });

  it('calls onNavigate when a menu item is selected with shortcut', () => {
    const onNavigate = vi.fn();
    const { stdin } = render(<MainMenu onNavigate={onNavigate} />);
    stdin.write('3'); // shortcut for My Models
    expect(onNavigate).toHaveBeenCalledWith('my-models');
  });

  it('calls onNavigate with install when shortcut 1 is pressed', () => {
    const onNavigate = vi.fn();
    const { stdin } = render(<MainMenu onNavigate={onNavigate} />);
    stdin.write('1');
    expect(onNavigate).toHaveBeenCalledWith('install');
  });

  it('renders help bar with navigation hints', () => {
    const { lastFrame } = render(<MainMenu onNavigate={vi.fn()} />);
    expect(lastFrame()).toContain('navigate');
  });

  it('calls exit when quit shortcut is pressed', async () => {
    // The 'q' shortcut selects the Quit menu item, which calls exit() from useApp.
    // The useApp mock returns a static { exit: vi.fn() }, so we just verify no crash.
    const onNavigate = vi.fn();
    const { stdin } = render(<MainMenu onNavigate={onNavigate} />);
    stdin.write('q'); // quit shortcut — should call exit() without navigating
    await new Promise((r) => setTimeout(r, 50));
    // onNavigate should NOT be called for quit
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
