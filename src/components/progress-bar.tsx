import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  percent: number;
  width?: number;
  label?: string;
}

export function ProgressBar({ percent, width = 30, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  return (
    <Box flexDirection="column">
      {label && <Text>{label}</Text>}
      <Box>
        <Text color="cyan">{'█'.repeat(filled)}</Text>
        <Text color="gray">{'░'.repeat(empty)}</Text>
        <Text> {clamped.toFixed(1)}%</Text>
      </Box>
    </Box>
  );
}
