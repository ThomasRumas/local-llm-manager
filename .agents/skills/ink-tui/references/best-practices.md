# Ink TUI Best Practices

## Project Setup

```bash
# TypeScript scaffold (recommended)
npx create-ink-app --typescript my-cli

# Manual setup
npm install ink react
npm install -D @types/react typescript
```

Required Node.js 22+. Ink is ESM-only — use `"type": "module"` in `package.json`.

---

## Layout Patterns

### Use Flexbox, Not Hardcoded Spacing

```tsx
// BAD — hardcoded spaces
<Text>Name:     John</Text>

// GOOD — Flexbox layout
<Box>
  <Box width={10}><Text>Name:</Text></Box>
  <Text>John</Text>
</Box>
```

### Responsive Layouts

```tsx
const { columns } = useWindowSize();

<Box flexDirection={columns < 80 ? 'column' : 'row'}>
  <Sidebar />
  <MainContent />
</Box>;
```

### Common Layout Patterns

```tsx
// Header / Content / Footer
<Box flexDirection="column" height="100%">
  <Box><Text bold>My App</Text></Box>
  <Box flexGrow={1}><Content /></Box>
  <Box><Text dimColor>Press q to quit</Text></Box>
</Box>

// Sidebar + Main
<Box>
  <Box width={20} borderStyle="single" flexDirection="column">
    <Text bold>Menu</Text>
    <MenuItem label="Home" />
    <MenuItem label="Settings" />
  </Box>
  <Box flexGrow={1} paddingLeft={1}>
    <MainContent />
  </Box>
</Box>

// Centered content
<Box justifyContent="center" alignItems="center" width="100%" height="100%">
  <Box borderStyle="round" padding={2}>
    <Text>Dialog Box</Text>
  </Box>
</Box>

// Status bar at bottom
<Box flexDirection="column">
  <Box flexGrow={1}><MainContent /></Box>
  <Box justifyContent="space-between">
    <Text dimColor>v1.0.0</Text>
    <Text dimColor>Press ? for help</Text>
  </Box>
</Box>
```

---

## Input Handling

### Keyboard Navigation Pattern

```tsx
const MenuList = ({ items }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
    }
    if (key.return) {
      onSelect(items[selectedIndex]);
    }
    if (input === 'q') {
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <Text key={item.id} color={i === selectedIndex ? 'green' : undefined}>
          {i === selectedIndex ? '>' : ' '} {item.label}
        </Text>
      ))}
    </Box>
  );
};
```

### Guard Input with isActive

When multiple components use `useInput`, guard with `isActive` to prevent double handling:

```tsx
const Panel = ({ isActive }) => {
  useInput(
    (input, key) => {
      // Only fires when this panel is active
    },
    { isActive },
  );
};
```

### Separate Paste from Keyboard Input

```tsx
useInput((input, key) => {
  // Typed characters only (NOT pasted text when usePaste is active)
});

usePaste((text) => {
  // Full pasted string, newlines preserved
});
```

---

## Focus Management

### Tab Navigation

```tsx
const FocusableInput = ({ label, onSubmit }) => {
  const { isFocused } = useFocus();

  useInput(
    (input, key) => {
      if (key.return && isFocused) {
        onSubmit();
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box
      borderStyle={isFocused ? 'round' : 'single'}
      borderColor={isFocused ? 'green' : undefined}
    >
      <Text>{label}</Text>
    </Box>
  );
};
```

### Programmatic Focus

```tsx
const FormWizard = () => {
  const { focus } = useFocusManager();

  const handleNext = () => {
    focus('step-2'); // Jump to specific field
  };

  return (
    <Box flexDirection="column">
      <Field id="step-1" label="Name" />
      <Field id="step-2" label="Email" />
      <Button onPress={handleNext} label="Next" />
    </Box>
  );
};
```

---

## Performance

### Use `<Static>` for Permanent Output

For logs, completed tasks, or any output that won't change — use `<Static>` to avoid re-rendering:

```tsx
<>
  <Static items={completedTasks}>
    {(task) => (
      <Box key={task.id}>
        <Text color="green">✔ {task.title}</Text>
      </Box>
    )}
  </Static>
  <Box marginTop={1}>
    <Text>Running: {currentTask}</Text>
  </Box>
</>
```

### Limit Re-renders

- Use `maxFps` to cap frame rate for high-frequency updates
- Enable `incrementalRendering` to only update changed lines
- Use `React.memo` for expensive subtrees

```tsx
render(<App />, {
  maxFps: 15, // Lower FPS for CPU savings
  incrementalRendering: true, // Only update changed lines
});
```

### Alternate Screen for Full-Screen Apps

```tsx
render(<App />, { alternateScreen: true });
// Restores original terminal on exit (like vim/htop)
```

---

## Graceful Exit

```tsx
const App = () => {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Close connections, clean temp files, etc.
    };
  }, []);
};
```

---

## Accessibility

### ARIA Props

```tsx
// Checkbox
<Box aria-role="checkbox" aria-state={{checked: isChecked}}>
  <Text>{isChecked ? '[x]' : '[ ]'} Accept terms</Text>
</Box>

// Progress bar with screen reader label
<Box>
  <Box width="50%" height={1} backgroundColor="green" />
  <Text aria-label="Progress: 50%">50%</Text>
</Box>

// Hidden decorative elements
<Text aria-hidden>═══════════════</Text>
```

### Screen Reader Adaptation

```tsx
const StatusIndicator = ({ status }) => {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();

  if (isScreenReaderEnabled) {
    return <Text>Status: {status}</Text>;
  }

  return (
    <Box>
      <Text color={status === 'ok' ? 'green' : 'red'}>●</Text>
      <Text> {status}</Text>
    </Box>
  );
};
```

### Supported ARIA Roles

`button`, `checkbox`, `radio`, `radiogroup`, `list`, `listitem`, `menu`, `menuitem`, `progressbar`, `tab`, `tablist`, `timer`, `toolbar`, `table`

### Supported ARIA States

`checked` (boolean), `disabled` (boolean), `expanded` (boolean), `selected` (boolean)

---

## Testing

Use `ink-testing-library` for unit testing Ink components:

```tsx
import { render } from 'ink-testing-library';
import { Text } from 'ink';

test('renders text', () => {
  const { lastFrame } = render(<Text>Hello</Text>);
  expect(lastFrame()).toBe('Hello');
});

// Test with input
test('handles keyboard input', async () => {
  const { lastFrame, stdin } = render(<MyComponent />);

  // Simulate key press
  stdin.write('q');

  expect(lastFrame()).toContain('Goodbye');
});

// String rendering for snapshots
import { renderToString } from 'ink';

test('snapshot test', () => {
  const output = renderToString(<MyLayout />, { columns: 80 });
  expect(output).toMatchSnapshot();
});
```

### React Devtools

```bash
# Enable devtools
DEV=true node my-cli.js

# In another terminal
npx react-devtools
```

---

## CI Behavior

Ink auto-detects CI environments (via `CI` env var):

- Only renders the last frame on exit
- Disables terminal resize listeners
- Disables ANSI erase sequences

Override with `CI=false node my-cli.js` if your CI supports full terminal rendering.

---

## Common Pitfalls

| Problem                      | Cause                               | Fix                                                                    |
| ---------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| Raw text crashes             | Text outside `<Text>`               | Wrap all strings in `<Text>`                                           |
| `<Box>` inside `<Text>`      | Invalid nesting                     | `<Text>` only accepts text and nested `<Text>`                         |
| `console.log` garbles output | Direct stdout writes mix with Ink   | Use `useStdout().write()` or `<Static>`                                |
| App exits immediately        | No async work in event loop         | Add `useInput`, timers, or promises                                    |
| Focus doesn't work           | Missing `useFocus()` in component   | Call `useFocus()` in focusable components                              |
| Layout wrong after resize    | Not using `useWindowSize`           | Add `useWindowSize` for responsive layouts                             |
| `measureElement` returns 0   | Called during render                | Call from `useEffect` / `useLayoutEffect`                              |
| Input handled twice          | Multiple `useInput` without guards  | Use `isActive` option                                                  |
| `<Static>` items re-render   | Modifying previously rendered items | Only append new items; old ones are frozen                             |
| Ctrl+C doesn't work          | Custom raw mode                     | Use Ink's `setRawMode` from `useStdin`, not `process.stdin.setRawMode` |

---

## Concurrent Mode

Enable for Suspense, `useTransition`, and `useDeferredValue`:

```tsx
render(<App />, { concurrent: true });
```

### Suspense Example

```tsx
const AsyncData = () => {
  const data = use(fetchData()); // React's use() hook

  return <Text>{data}</Text>;
};

const App = () => (
  <Suspense fallback={<Text>Loading...</Text>}>
    <AsyncData />
  </Suspense>
);

render(<App />, { concurrent: true });
```

---

## Kitty Keyboard Protocol

Enhanced keyboard support for compatible terminals (kitty, WezTerm, Ghostty):

```tsx
render(<App />, {
  kittyKeyboard: {
    mode: 'auto', // 'auto' | 'enabled' | 'disabled'
    flags: ['disambiguateEscapeCodes', 'reportEventTypes'],
  },
});
```

Enables: `key.super`, `key.hyper`, `key.capsLock`, `key.numLock`, `key.eventType` (press/repeat/release), and disambiguation of Ctrl+I vs Tab, Shift+Enter vs Enter, etc.
