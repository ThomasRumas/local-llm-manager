import { Box, Text, useInput, useFocus } from 'ink';

interface TextInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextInputField({
  label,
  value,
  onChange,
  placeholder,
}: TextInputFieldProps) {
  const { isFocused } = useFocus();

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (
      !key.ctrl &&
      !key.meta &&
      !key.upArrow &&
      !key.downArrow &&
      !key.return &&
      !key.tab &&
      !key.escape
    ) {
      onChange(value + input);
    }
  });

  return (
    <Box>
      <Text color={isFocused ? 'cyan' : 'white'}>{label}: </Text>
      <Text color={isFocused ? 'white' : 'gray'}>
        {value || (placeholder ? <Text color="gray">{placeholder}</Text> : '')}
      </Text>
      {isFocused && <Text color="cyan">▎</Text>}
    </Box>
  );
}
