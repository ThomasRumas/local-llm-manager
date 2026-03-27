# Ink Components Reference

## `<Text>`

Displays styled text. Only accepts text nodes and nested `<Text>` — no `<Box>` inside.

```tsx
import {Text} from 'ink';

<Text color="green">Green text</Text>
<Text color="#005cc5">Hex blue</Text>
<Text color="rgb(232, 131, 136)">RGB red</Text>
<Text backgroundColor="white" color="black">Inverted</Text>
<Text bold>Bold</Text>
<Text italic>Italic</Text>
<Text underline>Underlined</Text>
<Text strikethrough>Struck</Text>
<Text inverse>Inverse colors</Text>
<Text dimColor>Dimmed</Text>
```

### Text Props

| Prop              | Type      | Default  | Description                                                                       |
| ----------------- | --------- | -------- | --------------------------------------------------------------------------------- |
| `color`           | `string`  | —        | Text color (named, hex `#005cc5`, or `rgb()`)                                     |
| `backgroundColor` | `string`  | —        | Background color                                                                  |
| `dimColor`        | `boolean` | `false`  | Dim the color                                                                     |
| `bold`            | `boolean` | `false`  | Bold text                                                                         |
| `italic`          | `boolean` | `false`  | Italic text                                                                       |
| `underline`       | `boolean` | `false`  | Underlined text                                                                   |
| `strikethrough`   | `boolean` | `false`  | Strikethrough text                                                                |
| `inverse`         | `boolean` | `false`  | Swap foreground and background                                                    |
| `wrap`            | `string`  | `'wrap'` | `'wrap'`, `'truncate'`, `'truncate-start'`, `'truncate-middle'`, `'truncate-end'` |

### Text Wrapping and Truncation

```tsx
<Box width={7}>
  <Text>Hello World</Text>
</Box>
// 'Hello\nWorld'

<Box width={7}>
  <Text wrap="truncate">Hello World</Text>
</Box>
// 'Hello…'

<Box width={7}>
  <Text wrap="truncate-middle">Hello World</Text>
</Box>
// 'He…ld'

<Box width={7}>
  <Text wrap="truncate-start">Hello World</Text>
</Box>
// '…World'
```

---

## `<Box>`

Layout container — think `<div style="display: flex">`. Every `<Box>` is a Flexbox container.

```tsx
import { Box, Text } from 'ink';

<Box margin={2}>
  <Text>This is a box with margin</Text>
</Box>;
```

### Dimensions

| Prop          | Type               | Default | Description                                     |
| ------------- | ------------------ | ------- | ----------------------------------------------- |
| `width`       | `number \| string` | —       | Width in spaces or percentage                   |
| `height`      | `number \| string` | —       | Height in lines or percentage                   |
| `minWidth`    | `number`           | —       | Minimum width                                   |
| `minHeight`   | `number \| string` | —       | Minimum height                                  |
| `maxWidth`    | `number`           | —       | Maximum width                                   |
| `maxHeight`   | `number \| string` | —       | Maximum height                                  |
| `aspectRatio` | `number`           | —       | Width/height ratio (use with a size constraint) |

### Padding

| Prop            | Type     | Default |
| --------------- | -------- | ------- |
| `padding`       | `number` | `0`     |
| `paddingX`      | `number` | `0`     |
| `paddingY`      | `number` | `0`     |
| `paddingTop`    | `number` | `0`     |
| `paddingBottom` | `number` | `0`     |
| `paddingLeft`   | `number` | `0`     |
| `paddingRight`  | `number` | `0`     |

### Margin

| Prop           | Type     | Default |
| -------------- | -------- | ------- |
| `margin`       | `number` | `0`     |
| `marginX`      | `number` | `0`     |
| `marginY`      | `number` | `0`     |
| `marginTop`    | `number` | `0`     |
| `marginBottom` | `number` | `0`     |
| `marginLeft`   | `number` | `0`     |
| `marginRight`  | `number` | `0`     |

### Gap

| Prop        | Type     | Default | Description                          |
| ----------- | -------- | ------- | ------------------------------------ |
| `gap`       | `number` | `0`     | Shorthand for `columnGap` + `rowGap` |
| `columnGap` | `number` | `0`     | Space between columns                |
| `rowGap`    | `number` | `0`     | Space between rows                   |

### Flex Layout

| Prop             | Type               | Default        | Values                                                                                          |
| ---------------- | ------------------ | -------------- | ----------------------------------------------------------------------------------------------- |
| `flexDirection`  | `string`           | `'row'`        | `'row'`, `'row-reverse'`, `'column'`, `'column-reverse'`                                        |
| `flexWrap`       | `string`           | `'nowrap'`     | `'nowrap'`, `'wrap'`, `'wrap-reverse'`                                                          |
| `flexGrow`       | `number`           | `0`            | How much the item grows                                                                         |
| `flexShrink`     | `number`           | `1`            | How much the item shrinks                                                                       |
| `flexBasis`      | `number \| string` | —              | Initial size before flex                                                                        |
| `alignItems`     | `string`           | —              | `'flex-start'`, `'center'`, `'flex-end'`, `'stretch'`, `'baseline'`                             |
| `alignSelf`      | `string`           | `'auto'`       | Same as alignItems + `'auto'`                                                                   |
| `alignContent`   | `string`           | `'flex-start'` | For multi-line flex containers                                                                  |
| `justifyContent` | `string`           | —              | `'flex-start'`, `'center'`, `'flex-end'`, `'space-between'`, `'space-around'`, `'space-evenly'` |

```tsx
// Horizontal layout with spacing
<Box gap={1}>
  <Text>A</Text>
  <Text>B</Text>
</Box>

// Vertical layout
<Box flexDirection="column" rowGap={1}>
  <Text>Line 1</Text>
  <Text>Line 2</Text>
</Box>

// Center content
<Box justifyContent="center" alignItems="center" height={10}>
  <Text>Centered</Text>
</Box>

// Push items apart
<Box justifyContent="space-between">
  <Text>Left</Text>
  <Text>Right</Text>
</Box>
```

### Position

| Prop       | Type               | Default      | Description                            |
| ---------- | ------------------ | ------------ | -------------------------------------- |
| `position` | `string`           | `'relative'` | `'relative'`, `'absolute'`, `'static'` |
| `top`      | `number \| string` | —            | Top offset (percentage supported)      |
| `right`    | `number \| string` | —            | Right offset                           |
| `bottom`   | `number \| string` | —            | Bottom offset                          |
| `left`     | `number \| string` | —            | Left offset                            |

### Visibility

| Prop        | Type     | Default     | Description                  |
| ----------- | -------- | ----------- | ---------------------------- |
| `display`   | `string` | `'flex'`    | `'flex'` or `'none'` to hide |
| `overflow`  | `string` | `'visible'` | `'visible'` or `'hidden'`    |
| `overflowX` | `string` | `'visible'` | Horizontal overflow          |
| `overflowY` | `string` | `'visible'` | Vertical overflow            |

### Borders

```tsx
<Box borderStyle="round" borderColor="green">
  <Text>Rounded green box</Text>
</Box>

// Available styles: 'single', 'double', 'round', 'bold',
// 'singleDouble', 'doubleSingle', 'classic'

// Custom border characters
<Box borderStyle={{
  topLeft: '↘', top: '↓', topRight: '↙',
  left: '→', right: '←',
  bottomLeft: '↗', bottom: '↑', bottomRight: '↖',
}}>
  <Text>Custom borders</Text>
</Box>

// Selective borders
<Box borderStyle="single" borderTop borderBottom borderLeft={false} borderRight={false}>
  <Text>Top and bottom only</Text>
</Box>
```

| Prop                          | Type                 | Default |
| ----------------------------- | -------------------- | ------- |
| `borderStyle`                 | `string \| BoxStyle` | —       |
| `borderColor`                 | `string`             | —       |
| `borderTop/Right/Bottom/Left` | `boolean`            | `true`  |
| `borderTopColor`, etc.        | `string`             | —       |
| `borderDimColor`              | `boolean`            | `false` |

### Background

```tsx
<Box backgroundColor="blue" padding={1}>
  <Text>Blue background</Text>
</Box>
```

---

## `<Newline>`

Inserts newline(s). Must be used inside `<Text>`.

```tsx
<Text>
  <Text color="green">Hello</Text>
  <Newline />
  <Text color="red">World</Text>
</Text>

// Multiple newlines
<Newline count={3} />
```

---

## `<Spacer>`

Flexible space that expands along the main axis.

```tsx
// Push items to edges
<Box>
  <Text>Left</Text>
  <Spacer />
  <Text>Right</Text>
</Box>

// Vertical spacer
<Box flexDirection="column" height={10}>
  <Text>Top</Text>
  <Spacer />
  <Text>Bottom</Text>
</Box>
```

---

## `<Static>`

Permanently renders output above everything else. Use for completed tasks, logs, or items that won't change after rendering.

**Critical:** `<Static>` only renders _new_ items. Changes to previously rendered items are ignored.

```tsx
import { Static, Box, Text } from 'ink';

const App = () => {
  const [tests, setTests] = useState([]);

  return (
    <>
      <Static items={tests}>
        {(test) => (
          <Box key={test.id}>
            <Text color="green">✔ {test.title}</Text>
          </Box>
        )}
      </Static>

      <Box marginTop={1}>
        <Text dimColor>Completed: {tests.length}</Text>
      </Box>
    </>
  );
};
```

| Prop       | Type                         | Description                                      |
| ---------- | ---------------------------- | ------------------------------------------------ |
| `items`    | `Array`                      | Items to render                                  |
| `style`    | `object`                     | Box styles for the container                     |
| `children` | `(item, index) => ReactNode` | Render function (must return element with `key`) |

---

## `<Transform>`

Transforms the string output of child `<Text>` components before rendering.

**Rules:**

- Apply only to `<Text>` children
- Must not change output dimensions (layout will break)
- Styled text contains ANSI escape codes — use `slice-ansi` / `strip-ansi` for string operations

```tsx
import {Transform, Text} from 'ink';

// Uppercase
<Transform transform={output => output.toUpperCase()}>
  <Text>Hello World</Text>
</Transform>
// Output: HELLO WORLD

// Hanging indent
<Transform transform={(line, index) =>
  index === 0 ? line : '    ' + line
}>
  <Text>{longText}</Text>
</Transform>
```
