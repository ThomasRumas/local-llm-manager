import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Table, type TableColumn } from './table.js';

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Name', width: 20 },
  { key: 'size', label: 'Size', width: 8, align: 'right' },
];

const ROWS = [
  { name: 'ModelAlpha', size: '4.2G' },
  { name: 'ModelBeta', size: '2.1G' },
];

describe('Table', () => {
  it('renders column headers', () => {
    const { lastFrame } = render(<Table columns={COLUMNS} rows={ROWS} selectedIndex={0} />);
    expect(lastFrame()).toContain('NAME');
    expect(lastFrame()).toContain('SIZE');
  });

  it('renders row data', () => {
    const { lastFrame } = render(<Table columns={COLUMNS} rows={ROWS} selectedIndex={0} />);
    expect(lastFrame()).toContain('ModelAlpha');
    expect(lastFrame()).toContain('ModelBeta');
  });

  it('renders selection indicator ❯ on selected row', () => {
    const { lastFrame } = render(<Table columns={COLUMNS} rows={ROWS} selectedIndex={1} />);
    const lines = lastFrame()!.split('\n');
    const selectedLine = lines.find((l) => l.includes('❯'));
    expect(selectedLine).toContain('ModelBeta');
  });

  it('renders empty table without crashing', () => {
    expect(() => render(<Table columns={COLUMNS} rows={[]} selectedIndex={0} />)).not.toThrow();
  });

  it('truncates long cell values with ellipsis', () => {
    const longRows = [{ name: 'A'.repeat(30), size: '1G' }];
    const { lastFrame } = render(<Table columns={COLUMNS} rows={longRows} selectedIndex={0} />);
    expect(lastFrame()).toContain('…');
  });
});
