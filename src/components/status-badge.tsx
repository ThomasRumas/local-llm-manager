import React from 'react';
import { Box, Text } from 'ink';

interface StatusBadgeProps {
  status: 'success' | 'error' | 'warning' | 'info' | 'loading';
  label: string;
}

const STATUS_CONFIG = {
  success: { color: 'green' as const, icon: '✔' },
  error: { color: 'red' as const, icon: '✖' },
  warning: { color: 'yellow' as const, icon: '⚠' },
  info: { color: 'blue' as const, icon: 'ℹ' },
  loading: { color: 'cyan' as const, icon: '⟳' },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Box>
      <Text color={config.color}>
        {config.icon} {label}
      </Text>
    </Box>
  );
}
