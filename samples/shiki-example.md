# Shiki Example

Hover any code block below to reveal the copy button.

## JavaScript

```javascript
function zoom(level, delta) {
  return Math.min(Math.max(level + delta, 0.5), 3);
}

const config = { theme: 'github-dark', langs: ['js', 'ts'] };
```

## TypeScript

```typescript
interface Highlighter {
  codeToHtml(code: string, opts: { lang: string; theme: string }): string;
}

function highlight<T extends Highlighter>(h: T, code: string): string {
  return h.codeToHtml(code, { lang: 'ts', theme: 'github-dark' });
}
```

## Python

```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    mid = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + mid + quicksort(right)
```

## Rust

```rust
fn fibonacci(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}
```

## Bash

```bash
#!/usr/bin/env bash
set -euo pipefail

for f in samples/*.md; do
  echo "Rendering $f"
done
```

## JSON

```json
{
  "name": "markdown-preview-basic",
  "dependencies": {
    "shiki": "^4.4.1",
    "mermaid": "^11.16.0"
  }
}
```

## YAML

```yaml
name: preview
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
```

## SQL

```sql
SELECT id, name, created_at
FROM users
WHERE active = true
ORDER BY created_at DESC
LIMIT 10;
```

## Diff

```diff
- const md = new MarkdownIt({ html: true });
+ const md = makeMarkdownIt(highlighter, shikiTheme);
```

## Unrecognized language (fallback, no highlighting)

```brainfuck
++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.
```

## Inline code

Use `getHighlighter()` once and cache the promise; call `codeToHtml()` per block.
