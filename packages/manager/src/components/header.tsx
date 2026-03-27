import { Box, Text } from 'ink';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = 'Local LLM Manager', subtitle }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>
      {subtitle && <Text color="gray">{subtitle}</Text>}
      <Text color="gray">{'─'.repeat(40)}</Text>
    </Box>
  );
}
