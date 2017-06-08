/* eslint-env jest, node */
import postcss from "postcss";
import stripIndent from "strip-indent";
import plugin from "../src";

const strip = input =>
  stripIndent(input).replace(/^\n/, "").replace(/\s+$/, "");
const compile = (input, options) =>
  postcss([plugin(options)])
    .process(input, options)
    .catch(e => Promise.reject(e.message));
const generateScopedName = name => `__scope__${name}`;

const runCSS = ({ fixture, expected, options }) => {
  return expect(
    compile(
      strip(fixture),
      Object.assign({ generateScopedName }, options)
    ).then(result => result.css)
  ).resolves.toEqual(strip(expected));
};

const runError = ({ fixture, error, options }) => {
  return expect(compile(strip(fixture), options)).rejects.toMatch(
    RegExp(error)
  );
};

test("scope selectors", () => {
  return runCSS({
    fixture: `
      .foobar {}
    `,
    expected: `
      :export {
        foobar: __scope__foobar
      }
      .__scope__foobar {}
    `
  });
});

test("scope ids", () => {
  return runCSS({
    fixture: `
      #foobar {}
    `,
    expected: `
      :export {
        foobar: __scope__foobar
      }
      #__scope__foobar {}
    `
  });
});

test("scope multiple selectors", () => {
  return runCSS({
    fixture: `
      .foo, .bar {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo, .__scope__bar {}
    `
  });
});

test("scope sibling selectors", () => {
  return runCSS({
    fixture: `
      .foo ~ .bar {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo ~ .__scope__bar {}
    `
  });
});

test("scope next sibling selectors", () => {
  return runCSS({
    fixture: `
      .foo + .bar {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo + .__scope__bar {}
    `
  });
});

test("scope psuedo elements", () => {
  return runCSS({
    fixture: `
      .foo:after {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo:after {}
    `
  });
});

test("scope media queries", () => {
  return runCSS({
    fixture: `
      @media only screen { .foo {} }
    `,
    expected: `
      :export {
        foo: __scope__foo
      } @media only screen { .__scope__foo {} }
    `
  });
});

test("allow narrow global selectors", () => {
  return runCSS({
    fixture: `
      :global(.foo .bar) {}
    `,
    expected: `
      .foo .bar {}
    `
  });
});

test("allow operators before :global", () => {
  return runCSS({
    fixture: `
      .foo > :global .bar {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo > .bar {}
    `
  });
});

test("allow narrow local selectors", () => {
  return runCSS({
    fixture: `
      :local(.foo .bar) {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo .__scope__bar {}
    `
  });
});

test("allow broad global selectors", () => {
  return runCSS({
    fixture: `
      :global .foo .bar {}
    `,
    expected: `
      .foo .bar {}
    `
  });
});

test("allow broad local selectors", () => {
  return runCSS({
    fixture: `
      :local .foo .bar {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo .__scope__bar {}
    `
  });
});

test("allow multiple narrow global selectors", () => {
  return runCSS({
    fixture: `
      :global(.foo), :global(.bar) {}
    `,
    expected: `
      .foo, .bar {}
    `
  });
});

test("allow multiple broad global selectors", () => {
  return runCSS({
    fixture: `
      :global .foo, :global .bar {}
    `,
    expected: `
      .foo, .bar {}
    `
  });
});

test("allow multiple broad local selectors", () => {
  return runCSS({
    fixture: `
      :local .foo, :local .bar {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo, .__scope__bar {}
    `
  });
});

test("allow narrow global selectors nested inside local styles", () => {
  return runCSS({
    fixture: `
      .foo :global(.foo .bar) {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo .foo .bar {}
    `
  });
});

test("allow broad global selectors nested inside local styles", () => {
  return runCSS({
    fixture: `
      .foo :global .foo .bar {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo .foo .bar {}
    `
  });
});

test("allow parentheses inside narrow global selectors", () => {
  return runCSS({
    fixture: `
      .foo :global(.foo:not(.bar)) {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo .foo:not(.bar) {}
    `
  });
});

test("allow parentheses inside narrow local selectors", () => {
  return runCSS({
    fixture: `
      .foo :local(.foo:not(.bar)) {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo .__scope__foo:not(.__scope__bar) {}
    `
  });
});

test("allow narrow global selectors appended to local styles", () => {
  return runCSS({
    fixture: `
      .foo:global(.foo.bar) {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo.foo.bar {}
    `
  });
});

test("convert selectors with local nested pseudo class", () => {
  return runCSS({
    fixture: `
      :local(.foo) {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo {}
    `
  });
});

test("convert nested selectors with local nested pseudo class", () => {
  return runCSS({
    fixture: `
      :local(.foo) :local(.bar) {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo .__scope__bar {}
    `
  });
});

test("convert multiple selectors with local nested pseudo class", () => {
  return runCSS({
    fixture: `
      :local(.foo), :local(.bar) {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo, .__scope__bar {}
    `
  });
});

test("convert sibling selectors with local nested pseudo class", () => {
  return runCSS({
    fixture: `
      :local(.foo) ~ :local(.bar) {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        bar: __scope__bar
      }
      .__scope__foo ~ .__scope__bar {}
    `
  });
});

test("convert psuedo elements with local nested pseudo class", () => {
  return runCSS({
    fixture: `
      :local(.foo):after {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo:after {}
    `
  });
});

test("broad global should be limited to selector", () => {
  return runCSS({
    fixture: `
      :global .foo, .bar :global, .foobar :global {}
    `,
    expected: `
      :export {
        bar: __scope__bar;
        foobar: __scope__foobar
      }
      .foo, .__scope__bar, .__scope__foobar {}
    `
  });
});

test("broad global should be limited to nested selector", () => {
  return runCSS({
    fixture: `
      .foo:not(:global .bar).foobar {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        foobar: __scope__foobar
      }
      .__scope__foo:not(.bar).__scope__foobar {}
    `
  });
});

test("broad global and local should allow switching", () => {
  return runCSS({
    fixture: `
      .foo :global .bar :local .foobar :local .barfoo {}
    `,
    expected: `
      :export {
        foo: __scope__foo;
        foobar: __scope__foobar;
        barfoo: __scope__barfoo
      }
      .__scope__foo .bar .__scope__foobar .__scope__barfoo {}
    `
  });
});

test("default to global when mode provided", () => {
  return runCSS({
    fixture: `
      .foo {}
    `,
    options: { mode: "global" },
    expected: `
      .foo {}
    `
  });
});

test("default to local when mode provided", () => {
  return runCSS({
    fixture: `
      .foo {}
    `,
    options: { mode: "local" },
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo {}
    `
  });
});

test("use correct spacing", () => {
  return runCSS({
    fixture: `
      .a :local .b {}
      .a:local(.b) {}
      .a:local( .b ) {}
      .a :local(.b) {}
      .a :local( .b ) {}
      :local(.a).b {}
      :local( .a ).b {}
      :local(.a) .b {}
      :local( .a ) .b {}
    `,
    options: { mode: "global" },
    expected: `
      :export {
        b: __scope__b;
        a: __scope__a
      }
      .a .__scope__b {}
      .a.__scope__b {}
      .a.__scope__b {}
      .a .__scope__b {}
      .a .__scope__b {}
      .__scope__a.b {}
      .__scope__a.b {}
      .__scope__a .b {}
      .__scope__a .b {}
    `
  });
});

test("compile explict global element", () => {
  return runCSS({
    fixture: `
      :global(input) {}
    `,
    expected: `
      input {}
    `
  });
});

test("compile explict global attribute", () => {
  return runCSS({
    fixture: ':global([type="radio"]), :not(:global [type="radio"]) {}',
    expected: '[type="radio"], :not([type="radio"]) {}'
  });
});

test("throw on nested :locals", () => {
  return runError({
    fixture: ":local(:local(.foo)) {}",
    error: /is not allowed inside/
  });
});

test("throw on nested :globals", () => {
  return runError({
    fixture: ":global(:global(.foo)) {}",
    error: /is not allowed inside/
  });
});

test("throw on nested mixed", () => {
  return runError({
    fixture: ":local(:global(.foo)) {}",
    error: /is not allowed inside/
  });
});

test("throw on nested broad :local", () => {
  return runError({
    fixture: ":global(:local .foo) {}",
    error: /is not allowed inside/
  });
});

test("throw on incorrect spacing with broad :global", () => {
  return runError({
    fixture: ".foo :global.bar {}",
    error: /Missing whitespace after :global/
  });
});

test("throw on incorrect spacing with broad :local", () => {
  return runError({
    fixture: ".foo:local .bar {}",
    error: /Missing whitespace before :local/
  });
});

test("throw on incorrect spacing with broad :local on both side", () => {
  return runError({
    fixture: ".foo:local.bar {}",
    error: /Missing whitespace before :local/
  });
});

test("throw on incorrect spacing with broad :global on both side", () => {
  return runError({
    fixture: ".foo:global.bar {}",
    error: /Missing whitespace before :global/
  });
});

test("pass through global element", () => {
  return runCSS({
    fixture: "input {}",
    expected: "input {}"
  });
});

test("localise class and pass through element", () => {
  return runCSS({
    fixture: `
      .foo input {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      .__scope__foo input {}
    `
  });
});

test("pass through attribute selector", () => {
  return runCSS({
    fixture: '[type="radio"] {}',
    expected: '[type="radio"] {}'
  });
});

test("not crash on atrule without nodes", () => {
  return runCSS({
    fixture: '@charset "utf-8";',
    expected: '@charset "utf-8";'
  });
});

test("not crash on a rule without nodes", () => {
  const inner = postcss.rule({ selector: ".b", ruleWithoutBody: true });
  const outer = postcss.rule({ selector: ".a" }).push(inner);
  const root = postcss.root().push(outer);
  inner.nodes = undefined;
  // postcss-less's stringify would honor `ruleWithoutBody` and omit the trailing `{}`
  return expect(
    compile(root, { generateScopedName }).then(result => result.css)
  ).resolves.toEqual(
    strip(`
      :export {
        a: __scope__a;
        b: __scope__b
      }
      .__scope__a {
        .__scope__b {}
      }
    `)
  );
});

test("not localize keyframes rules", () => {
  return runCSS({
    fixture: "@keyframes foo { from {} to {} }",
    expected: "@keyframes foo { from {} to {} }"
  });
});

test("generates default scoped name", () => {
  return expect(
    compile(
      strip(`
                .foo {}
            `),
      { from: "/path/to/file.css" }
    ).then(result => result.css)
  ).resolves.toEqual(
    strip(`
          :export {
            foo: file__foo---2jzU5
          }
          .file__foo---2jzU5 {}
        `)
  );
});

test("reuse :export statements", () => {
  return runCSS({
    fixture: `
      :export {
        foo: __foo
      }
      .bar {}
    `,
    expected: `
      :export {
        foo: __foo;
        bar: __scope__bar
      }
      .__scope__bar {}
    `
  });
});

test("save :import statemtents", () => {
  return runCSS({
    fixture: `
      :import("~/lol.css") {
        foo: __foo
      }
    `,
    expected: `
      :import("~/lol.css") {
        foo: __foo
      }
    `
  });
});
