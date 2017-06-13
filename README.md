# postcss-icss-selectors [![Build Status][travis-img]][travis]

[PostCSS]: https://github.com/postcss/postcss
[travis-img]: https://travis-ci.org/css-modules/postcss-icss-selectors.svg
[travis]: https://travis-ci.org/css-modules/postcss-icss-selectors

PostCSS plugin for css modules to local-scope classes and ids

## Usage

```js
postcss([ require('postcss-icss-selectors')(options) ])
```

See [PostCSS] docs for examples for your environment.

### Options

#### mode

`local` by default or `global`

In local mode

```css
.foo { ... } /* => */ .file__foo---h63h { ... }

.foo .bar { ... } /* => */ .file__foo----h63h .file__bar----h63h { ... }

/* Shorthand global selector */

:global .foo .bar { ... } /* => */ .foo .bar { ... }

.foo :global .bar { ... } /* => */ .file__foo----h63h .bar { ... }

/* Targeted global selector */

:global(.foo) .bar { ... } /* => */ .foo .file__bar----h63h { ... }

.foo:global(.bar) { ... } /* => */ .file__foo----h63h.bar { ... }

.foo :global(.bar) .baz { ... } /* => */ .file__foo----h63h .bar .file__baz----h63h { ... }

.foo:global(.bar) .baz { ... } /* => */ .file__foo----h63h.bar .file__baz----h63h { ... }
```

In global mode

```css
.foo { ... } /* => */ .foo { ... }

.foo .bar { ... } /* => */ .foo .bar { ... }

/* Shorthand local selector */

:local .foo :global .bar { ... } /* => */ .file__foo----h63h .bar { ... }

.foo :local .bar { ... } /* => */ .foo .file__foo----h63h { ... }

/* Targeted local selector */

:local(.foo) .bar { ... } /* => */ .file__foo----h63h .bar { ... }

.foo:local(.bar) { ... } /* => */ .foo.file__bar----h63h { ... }

```

#### generateScopeName(localName, filepath, css)

Converts every new local name in #id or .class defintion to global alias.
By default returns `[name]__[local]---[hash:base64:5]`.

### Messages

postcss-icss-selectors passes result.messages for each local-scoped class or id

```
{
  plugin: 'postcss-icss-selectors',
  type: 'icss-scoped',
  name: string, // local-scoped identifier
  value: string // generated global identifier
}
```

## License

MIT © Mark Dalgleish and Bogdan Chadkin, 2015
