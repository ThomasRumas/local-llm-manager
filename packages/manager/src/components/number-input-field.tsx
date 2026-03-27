import { Box, Text, useInput, useFocus } from 'ink';

interface NumberInputFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export function NumberInputField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: NumberInputFieldProps) {
  const { isFocused } = useFocus();

  useInput((_input, key) => {
    if (!isFocused) return;

    if (key.leftArrow) {
      const newVal = value - step;
      onChange(min !== undefined ? Math.max(min, newVal) : newVal);
    } else if (key.rightArrow) {
      const newVal = value + step;
      onChange(max !== undefined ? Math.min(max, newVal) : newVal);
    }
  });

  return (
    <Box>
      <Text color={isFocused ? 'cyan' : 'white'}>{label}: </Text>
      <Text color={isFocused ? 'white' : 'gray'}>{value}</Text>
      {isFocused && <Text color="gray"> (←/→ to adjust)</Text>}
    </Box>
  );
}
