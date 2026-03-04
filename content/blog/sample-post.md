---
title: "A Sample Blog Post"
date: 2026-03-04
math: true
draft: true
---

This is a sample post demonstrating the capabilities of the blog.

## Markdown Basics

Regular prose is rendered in Minion Pro at a comfortable reading width. You can use **bold**, *italic*, and [links](https://example.com) as you'd expect.

### Lists

- First item
- Second item
- Third item with a longer description that wraps to the next line to show how the layout handles it

### Blockquotes

> The purpose of computing is insight, not numbers.
>
> — Richard Hamming

## Code

Inline code looks like `print("hello")`, and code blocks get syntax highlighting. Notice the Fira Code ligatures in `=>` and `!=`:

```python
import numpy as np

def estimate_prevalence(cases, population):
    """Estimate disease prevalence with a confidence interval."""
    p = cases / population
    se = np.sqrt(p * (1 - p) / population)
    return p, (p - 1.96 * se, p + 1.96 * se)
```

## Mathematics

When `math: true` is set in the front matter, you can use LaTeX via KaTeX.

Inline math: the odds ratio is $\text{OR} = \frac{ad}{bc}$.

Display math:

$$
\hat{\beta} = (X^T X)^{-1} X^T y
$$

The Bayesian posterior is proportional to the product of likelihood and prior:

$$
p(\theta \mid y) \propto p(y \mid \theta) \, p(\theta)
$$

## Enhanced Elements

Here is text with a sidenote.{{< sidenote >}}This is a sidenote — it appears in the margin on wide screens or toggles inline on narrow screens.{{< /sidenote >}} The sidenote number is clickable on mobile.

And here is a margin note.{{< marginnote >}}A margin note is like a sidenote but without a number — use it for brief annotations.{{< /marginnote >}} It uses the ⊕ symbol to toggle on narrow screens.

{{< pullquote cite="Richard Hamming" >}}The purpose of computing is insight, not numbers.{{< /pullquote >}}

{{< aside title="Note" >}}
This is an aside box — useful for definitions, warnings, or supplementary context. It supports **Markdown** formatting inside.
{{< /aside >}}

## Images

Images can be included with standard Markdown syntax and will scale responsively.

---

More features — maps, interlinear glosses, interactive visualizations — are coming soon.
