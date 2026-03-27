import { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface MenuItem {
  label: string;
  value: string;
  description?: string;
  shortcut?: string;
}

interface MenuListProps {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  title?: string;
}

export function MenuList({ items, onSelect, title }: MenuListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      const item = items[selectedIndex];
      if (item) {
        onSelect(item);
      }
    } else {
      const shortcutItem = items.find((item) => item.shortcut === input);
      if (shortcutItem) {
        onSelect(shortcutItem);
      }
    }
  });

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
        </Box>
      )}
      {items.map((item, index) => (
        <Box key={item.value}>
          <Text color={index === selectedIndex ? 'cyan' : undefined}>
            {index === selectedIndex ? '❯ ' : '  '}
            {item.shortcut ? `[${item.shortcut}] ` : ''}
            {item.label}
          </Text>
          {item.description && index === selectedIndex && (
            <Text color="gray"> — {item.description}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
