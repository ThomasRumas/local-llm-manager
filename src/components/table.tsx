import React from 'react';
import { Box, Text } from 'ink';

export interface TableColumn {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
}

interface TableProps {
  columns: TableColumn[];
  rows: Array<Record<string, string>>;
  selectedIndex: number;
}

function padCell(value: string, width: number, align: 'left' | 'right' = 'left'): string {
  if (value.length > width) return value.slice(0, width - 1) + '…';
  return align === 'right' ? value.padStart(width) : value.padEnd(width);
}

export function Table({ columns, rows, selectedIndex }: TableProps) {
  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        <Text bold color="gray">{'  '}</Text>
        {columns.map((col) => (
          <Box key={col.key} width={col.width + 2}>
            <Text bold color="gray">{padCell(col.label.toUpperCase(), col.width, col.align)}</Text>
          </Box>
        ))}
      </Box>
      {/* Separator */}
      <Text color="gray" dimColor>{'  ' + columns.map((c) => '─'.repeat(c.width)).join('  ')}</Text>

      {/* Data rows */}
      {rows.map((row, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={i}>
            <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? '❯ ' : '  '}</Text>
            {columns.map((col) => (
              <Box key={col.key} width={col.width + 2}>
                <Text
                  color={isSelected ? 'cyan' : 'white'}
                  wrap="truncate"
                >
                  {padCell(row[col.key] ?? '', col.width, col.align)}
                </Text>
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
