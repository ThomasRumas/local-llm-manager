# Ink Hooks Reference

## useInput(inputHandler, options?)

Handle keyboard input. Called for each character typed, or once for pasted text.

```tsx
import { useInput } from 'ink';

const MyComponent = () => {
  useInput((input, key) => {
    if (input === 'q') {
      // Exit
    }
    if (key.leftArrow) {
      // Navigate left
    }
    if (key.return) {
      // Submit
    }
    if (key.escape) {
      // Cancel
    }
    // Ctrl+S
    if (input === 's' && key.ctrl) {
      // Save
    }
  });

  return <Text>Press q to quit</Text>;
};
```

### Key Object Properties

| Property         | Type                  | Description                                         |
| ---------------- | --------------------- | --------------------------------------------------- |
| `key.leftArrow`  | `boolean`             | Left arrow pressed                                  |
| `key.rightArrow` | `boolean`             | Right arrow pressed                                 |
| `key.upArrow`    | `boolean`             | Up arrow pressed                                    |
| `key.downArrow`  | `boolean`             | Down arrow pressed                                  |
| `key.return`     | `boolean`             | Enter/Return pressed                                |
| `key.escape`     | `boolean`             | Escape pressed                                      |
| `key.ctrl`       | `boolean`             | Ctrl modifier                                       |
| `key.shift`      | `boolean`             | Shift modifier                                      |
| `key.meta`       | `boolean`             | Meta key pressed                                    |
| `key.tab`        | `boolean`             | Tab pressed                                         |
| `key.backspace`  | `boolean`             | Backspace pressed                                   |
| `key.delete`     | `boolean`             | Delete pressed                                      |
| `key.pageUp`     | `boolean`             | Page Up pressed                                     |
| `key.pageDown`   | `boolean`             | Page Down pressed                                   |
| `key.home`       | `boolean`             | Home pressed                                        |
| `key.end`        | `boolean`             | End pressed                                         |
| `key.super`      | `boolean`             | Cmd/Win (kitty protocol)                            |
| `key.hyper`      | `boolean`             | Hyper key (kitty protocol)                          |
| `key.eventType`  | `string \| undefined` | `'press'`, `'repeat'`, `'release'` (kitty protocol) |

### Options

| Option     | Type      | Default | Description                  |
| ---------- | --------- | ------- | ---------------------------- |
| `isActive` | `boolean` | `true`  | Enable/disable input capture |

```tsx
// Conditionally active input handler
useInput(
  (input, key) => {
    /* ... */
  },
  { isActive: isFocused },
);
```

---

## usePaste(handler, options?)

Handle pasted text separately from typed input. Enables bracketed paste mode automatically.

```tsx
import { useInput, usePaste } from 'ink';

const Editor = () => {
  useInput((input, key) => {
    // Only receives typed characters, NOT pasted text
    if (key.return) {
      /* submit */
    }
  });

  usePaste((text) => {
    // Receives the full pasted string
    console.log('Pasted:', text);
  });

  return <Text>Type or paste text</Text>;
};
```

| Option     | Type      | Default | Description                  |
| ---------- | --------- | ------- | ---------------------------- |
| `isActive` | `boolean` | `true`  | Enable/disable paste handler |

---

## useApp()

Access app lifecycle methods.

```tsx
import { useApp } from 'ink';

const MyComponent = () => {
  const { exit, waitUntilRenderFlush } = useApp();

  // Exit after timeout
  useEffect(() => {
    setTimeout(() => exit(), 5000);
  }, [exit]);

  // Exit with error
  exit(new Error('Something went wrong')); // rejects waitUntilExit()

  // Exit with result
  exit('done'); // resolves waitUntilExit() with 'done'

  // Wait for render flush
  useEffect(() => {
    void (async () => {
      await waitUntilRenderFlush();
      // Output is now flushed to stdout
    })();
  }, [waitUntilRenderFlush]);
};
```

---

## useStdin()

Access stdin stream and raw mode utilities.

```tsx
import { useStdin } from 'ink';

const MyComponent = () => {
  const { stdin, isRawModeSupported, setRawMode } = useStdin();

  // Check raw mode support before using it
  if (!isRawModeSupported) {
    return <Text>Raw mode not supported</Text>;
  }

  // Manage raw mode lifecycle
  useEffect(() => {
    setRawMode(true);
    return () => setRawMode(false);
  }, []);
};
```

**Important:** Use Ink's `setRawMode` instead of `process.stdin.setRawMode` to preserve Ctrl+C handling.

---

## useStdout()

Access stdout stream and write outside Ink's render output.

```tsx
import { useStdout } from 'ink';

const MyComponent = () => {
  const { stdout, write } = useStdout();

  useEffect(() => {
    // Write above Ink's output, like <Static> but for strings
    write('Hello from Ink to stdout\n');
  }, []);
};
```

---

## useStderr()

Same as `useStdout()` but for stderr.

```tsx
import { useStderr } from 'ink';

const MyComponent = () => {
  const { write } = useStderr();

  useEffect(() => {
    write('Error message to stderr\n');
  }, []);
};
```

---

## useBoxMetrics(ref)

Get layout metrics for a `<Box>` element. Updates on layout changes and terminal resize.

```tsx
import { useRef } from 'react';
import { Box, Text, useBoxMetrics } from 'ink';

const MeasuredBox = () => {
  const ref = useRef(null);
  const { width, height, left, top, hasMeasured } = useBoxMetrics(ref);

  return (
    <Box ref={ref}>
      <Text>
        {hasMeasured ? `${width}x${height} at ${left},${top}` : 'Measuring...'}
      </Text>
    </Box>
  );
};
```

Returns `{width: 0, height: 0, left: 0, top: 0}` until first layout pass.

---

## useWindowSize()

Get terminal dimensions. Re-renders on resize.

```tsx
import { useWindowSize, Text } from 'ink';

const ResponsiveLayout = () => {
  const { columns, rows } = useWindowSize();

  return (
    <Box flexDirection={columns < 80 ? 'column' : 'row'}>
      <Text>
        {columns}x{rows}
      </Text>
    </Box>
  );
};
```

---

## useFocus(options?)

Make a component focusable. User navigates with **Tab** / **Shift+Tab**.

```tsx
import { useFocus, Box, Text } from 'ink';

const FocusableItem = ({ label }) => {
  const { isFocused } = useFocus();

  return (
    <Box>
      <Text color={isFocused ? 'green' : undefined}>
        {isFocused ? '>' : ' '} {label}
      </Text>
    </Box>
  );
};
```

### Options

| Option      | Type      | Default | Description                                         |
| ----------- | --------- | ------- | --------------------------------------------------- |
| `autoFocus` | `boolean` | `false` | Auto-focus if no component is focused               |
| `isActive`  | `boolean` | `true`  | Enable/disable focus (keeps position in focus list) |
| `id`        | `string`  | —       | ID for programmatic focus via `useFocusManager`     |

---

## useFocusManager()

Programmatically manage focus across components.

```tsx
import { useFocusManager, useInput } from 'ink';

const FocusController = () => {
  const {
    focus,
    focusNext,
    focusPrevious,
    enableFocus,
    disableFocus,
    activeId,
  } = useFocusManager();

  useInput((input, key) => {
    if (input === 'j') focusNext();
    if (input === 'k') focusPrevious();
    if (input === 's') focus('settings'); // Focus by ID
  });

  return <Text>Focused: {activeId ?? 'none'}</Text>;
};
```

| Method/Property   | Description                                      |
| ----------------- | ------------------------------------------------ |
| `focusNext()`     | Focus next component (same as Tab)               |
| `focusPrevious()` | Focus previous component (same as Shift+Tab)     |
| `focus(id)`       | Focus component by its focus ID                  |
| `enableFocus()`   | Re-enable focus management                       |
| `disableFocus()`  | Disable focus for all components                 |
| `activeId`        | ID of currently focused component or `undefined` |

---

## useCursor()

Control terminal cursor position. Essential for IME support and text input.

```tsx
import { useState } from 'react';
import { Box, Text, useCursor } from 'ink';
import stringWidth from 'string-width';

const TextInput = () => {
  const [text, setText] = useState('');
  const { setCursorPosition } = useCursor();

  const prompt = '> ';
  setCursorPosition({ x: stringWidth(prompt + text), y: 1 });

  return (
    <Box flexDirection="column">
      <Text>Type here:</Text>
      <Text>
        {prompt}
        {text}
      </Text>
    </Box>
  );
};
```

Pass `undefined` to `setCursorPosition` to hide the cursor. Use `string-width` for correct x calculation with wide characters (CJK, emoji).

---

## useIsScreenReaderEnabled()

Detect if screen reader mode is active for accessible rendering.

```tsx
import { useIsScreenReaderEnabled, Text } from 'ink';

const StatusIndicator = ({ progress }) => {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();

  return isScreenReaderEnabled ? (
    <Text>Progress: {progress}%</Text>
  ) : (
    <ProgressBar value={progress} />
  );
};
```

---

## API Functions

### render(tree, options?)

Mount and render the app. Returns an `Instance` object.

```tsx
const instance = render(<App />, {
  exitOnCtrlC: true, // default: true
  patchConsole: true, // default: true — patches console.* to avoid mixing
  maxFps: 30, // default: 30
  incrementalRendering: false, // only update changed lines
  concurrent: false, // enable React Concurrent mode
  alternateScreen: false, // use alternate screen buffer (like vim)
  debug: false, // render each update separately
});
```

### Instance Methods

```tsx
const {
  rerender,
  unmount,
  waitUntilExit,
  waitUntilRenderFlush,
  clear,
  cleanup,
} = render(<App />);

rerender(<App count={2} />); // Update root component
unmount(); // Unmount the app
await waitUntilExit(); // Wait for app exit
await waitUntilRenderFlush(); // Wait for render flush to stdout
clear(); // Clear output
cleanup(); // Unmount + delete internal instance
```

### renderToString(tree, options?)

Synchronous string rendering (no terminal, no event listeners). For testing/documentation.

```tsx
import { renderToString, Text, Box } from 'ink';

const output = renderToString(
  <Box padding={1}>
    <Text color="green">Hello</Text>
  </Box>,
  { columns: 80 },
);
```

### measureElement(ref)

Measure a `<Box>` element's dimensions. Call from `useEffect`/`useLayoutEffect`, not during render.

```tsx
const ref = useRef();

useEffect(() => {
  const { width, height } = measureElement(ref.current);
}, []);

return (
  <Box ref={ref}>
    <Text>Content</Text>
  </Box>
);
```
