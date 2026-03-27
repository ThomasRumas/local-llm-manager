import React from 'react';
import { Box, Text } from 'ink';

interface HelpBarProps {
  items: Array<{ key: string; label: string }>;
}

export function HelpBar({ items }: HelpBarProps) {
  return (
    <Box marginTop={1}>
      <Text color="gray">
        {items.map((item, i) => (
          <Text key={item.key}>
            {i > 0 ? '  ' : ''}
            <Text bold color="yellow">{item.key}</Text>
            <Text color="gray"> {item.label}</Text>
          </Text>
        ))}
      </Text>
    </Box>
  );
}
