import { Box, Text, useInput, useFocus } from 'ink';

interface SelectFieldProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function SelectField({
  label,
  options,
  value,
  onChange,
}: SelectFieldProps) {
  const { isFocused } = useFocus();

  useInput((_input, key) => {
    if (!isFocused) return;

    const currentIndex = options.indexOf(value);
    if (key.leftArrow || key.rightArrow) {
      const direction = key.rightArrow ? 1 : -1;
      const nextIndex =
        (currentIndex + direction + options.length) % options.length;
      onChange(options[nextIndex]!);
    }
  });

  return (
    <Box>
      <Text color={isFocused ? 'cyan' : 'white'}>{label}: </Text>
      <Text color={isFocused ? 'white' : 'gray'}>{value}</Text>
      {isFocused && <Text color="gray"> (←/→ to toggle)</Text>}
    </Box>
  );
}
