# Advanced Markdown Example

A stress test for headings, code, tables, quotes, and links.

## Text formatting

Plain, **bold**, *italic*, ***bold italic***, ~~strikethrough~~ (GFM extension, not core — check if it renders), and `inline code`.

A bare URL via linkify: https://code.visualstudio.com

## Lists

### Unordered

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Ordered

1. Step one
2. Step two
   1. Sub-step
   2. Sub-step
3. Step three

## Code blocks

```js
function zoom(level, delta) {
  return Math.min(Math.max(level + delta, 0.5), 3);
}
```

```json
{
  "name": "markdown-preview-basic",
  "version": "0.0.1"
}
```

## Blockquote

> The best code is the code that never has to be written.
>
> — Someone, probably

## Table

| Feature       | Supported | Notes                  |
|---------------|-----------|-------------------------|
| Headings      | Yes       | h1–h6                   |
| Tables        | Yes       | via markdown-it core    |
| Task lists    | No        | needs a plugin          |
| Footnotes     | No        | needs a plugin          |
| Math          | Yes       | via MathJax 3           |

## Math

Inline: the quadratic formula is $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$.

Display:

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

## Links and images

[VS Code](https://code.visualstudio.com)

![A person playing](./oleksandrpidvalnyi-play-6865967_1920.jpg)

![Remote placeholder image](https://picsum.photos/800/400)

## Raw HTML

<details>
<summary>Click to expand (tests html:true)</summary>

Hidden content revealed via raw HTML passthrough.

</details>

## Horizontal rule

---

Done.
