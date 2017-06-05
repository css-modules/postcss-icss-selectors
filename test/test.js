/* eslint-env jest */
import postcss from "postcss";
import stripIndent from "strip-indent";
import plugin from "../src";

const strip = input => stripIndent(input).replace(/^n/, "");
const compile = (input, options) =>
  postcss([plugin(options)])
    .process(input)
    .catch(e => Promise.reject(e.message));

const runCSS = ({ fixture, expected, options }) => {
  return expect(
    compile(strip(fixture), options).then(result => result.css)
  ).resolves.toEqual(strip(expected));
};

const runError = ({ fixture, error, options }) => {
  return expect(compile(strip(fixture), options)).rejects.toMatch(
    RegExp(error)
  );
};

test("scope selectors", () => {
  return runCSS({
    fixture: ".foobar {}",
    expected: ":local(.foobar) {}"
  });
});

test("scope ids", () => {
  return runCSS({
    fixture: "#foobar {}",
    expected: ":local(#foobar) {}"
  });
});

test("scope multiple selectors", () => {
  return runCSS({
    fixture: ".foo, .baz {}",
    expected: ":local(.foo), :local(.baz) {}"
  });
});

test("scope sibling selectors", () => {
  return runCSS({
    fixture: ".foo ~ .baz {}",
    expected: ":local(.foo) ~ :local(.baz) {}"
  });
});

test("scope next sibling selectors", () => {
  return runCSS({
    fixture: ".foo + .bar {}",
    expected: ":local(.foo) + :local(.bar) {}"
  });
});

test("scope psuedo elements", () => {
  return runCSS({
    fixture: ".foo:after {}",
    expected: ":local(.foo):after {}"
  });
});

test("scope media queries", () => {
  return runCSS({
    fixture: "@media only screen { .foo {} }",
    expected: "@media only screen { :local(.foo) {} }"
  });
});

test("allow narrow global selectors", () => {
  return runCSS({
    fixture: ":global(.foo .bar) {}",
    expected: ".foo .bar {}"
  });
});

test("allow operators before :global", () => {
  return runCSS({
    fixture: ".foo > :global .bar {}",
    expected: ":local(.foo) > .bar {}"
  });
});

test("allow narrow local selectors", () => {
  return runCSS({
    fixture: ":local(.foo .bar) {}",
    expected: ":local(.foo) :local(.bar) {}"
  });
});

test("allow broad global selectors", () => {
  return runCSS({
    fixture: ":global .foo .bar {}",
    expected: ".foo .bar {}"
  });
});

test("allow broad local selectors", () => {
  return runCSS({
    fixture: ":local .foo .bar {}",
    expected: ":local(.foo) :local(.bar) {}"
  });
});

test("allow multiple narrow global selectors", () => {
  return runCSS({
    fixture: ":global(.foo), :global(.bar) {}",
    expected: ".foo, .bar {}"
  });
});

test("allow multiple broad global selectors", () => {
  return runCSS({
    fixture: ":global .foo, :global .bar {}",
    expected: ".foo, .bar {}"
  });
});

test("allow multiple broad local selectors", () => {
  return runCSS({
    fixture: ":local .foo, :local .bar {}",
    expected: ":local(.foo), :local(.bar) {}"
  });
});

test("allow narrow global selectors nested inside local styles", () => {
  return runCSS({
    fixture: ".foo :global(.foo .bar) {}",
    expected: ":local(.foo) .foo .bar {}"
  });
});

test("allow broad global selectors nested inside local styles", () => {
  return runCSS({
    fixture: ".foo :global .foo .bar {}",
    expected: ":local(.foo) .foo .bar {}"
  });
});

test("allow parentheses inside narrow global selectors", () => {
  return runCSS({
    fixture: ".foo :global(.foo:not(.bar)) {}",
    expected: ":local(.foo) .foo:not(.bar) {}"
  });
});

test("allow parentheses inside narrow local selectors", () => {
  return runCSS({
    fixture: ".foo :local(.foo:not(.bar)) {}",
    expected: ":local(.foo) :local(.foo):not(:local(.bar)) {}"
  });
});

test("allow narrow global selectors appended to local styles", () => {
  return runCSS({
    fixture: ".foo:global(.foo.bar) {}",
    expected: ":local(.foo).foo.bar {}"
  });
});

test("ignore selectors that are already local", () => {
  return runCSS({
    fixture: ":local(.foobar) {}",
    expected: ":local(.foobar) {}"
  });
});

test("ignore nested selectors that are already local", () => {
  return runCSS({
    fixture: ":local(.foo) :local(.bar) {}",
    expected: ":local(.foo) :local(.bar) {}"
  });
});

test("ignore multiple selectors that are already local", () => {
  return runCSS({
    fixture: ":local(.foo), :local(.bar) {}",
    expected: ":local(.foo), :local(.bar) {}"
  });
});

test("ignore sibling selectors that are already local", () => {
  return runCSS({
    fixture: ":local(.foo) ~ :local(.bar) {}",
    expected: ":local(.foo) ~ :local(.bar) {}"
  });
});

test("ignore psuedo elements that are already local", () => {
  return runCSS({
    fixture: ":local(.foo):after {}",
    expected: ":local(.foo):after {}"
  });
});

test("broad global should be limited to selector", () => {
  return runCSS({
    fixture: ":global .foo, .bar :global, .foobar :global {}",
    expected: ".foo, :local(.bar), :local(.foobar) {}"
  });
});

test("broad global should be limited to nested selector", () => {
  return runCSS({
    fixture: ".foo:not(:global .bar).foobar {}",
    expected: ":local(.foo):not(.bar):local(.foobar) {}"
  });
});

test("broad global and local should allow switching", () => {
  return runCSS({
    fixture: ".foo :global .bar :local .foobar :local .barfoo {}",
    expected: ":local(.foo) .bar :local(.foobar) :local(.barfoo) {}"
  });
});

test("default to global when mode provided", () => {
  return runCSS({
    fixture: ".foo {}",
    options: { mode: "global" },
    expected: ".foo {}"
  });
});

test("default to local when mode provided", () => {
  return runCSS({
    fixture: ".foo {}",
    options: { mode: "local" },
    expected: ":local(.foo) {}"
  });
});

test("use correct spacing", () => {
  return runCSS({
    fixture: `
      .a :local .b {}
      .a:local.b {}
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
      .a :local(.b) {}
      .a:local(.b) {}
      .a:local(.b) {}
      .a:local(.b) {}
      .a :local(.b) {}
      .a :local(.b) {}
      :local(.a).b {}
      :local(.a).b {}
      :local(.a) .b {}
      :local(.a) .b {}
    `
  });
});

test("ignore :export statements", () => {
  return runCSS({
    fixture: ":export { foo: __foo; }",
    expected: ":export { foo: __foo; }"
  });
});

test("ignore :import statemtents", () => {
  return runCSS({
    fixture: ':import("~/lol.css") { foo: __foo; }',
    expected: ':import("~/lol.css") { foo: __foo; }'
  });
});

test("compile in pure mode", () => {
  return runCSS({
    fixture: ':global(.foo).bar, [type="radio"] ~ .label, :not(.foo), #bar {}',
    options: { mode: "pure" },
    expected: '.foo:local(.bar), [type="radio"] ~ :local(.label), :not(:local(.foo)), :local(#bar) {}'
  });
});

test("compile explict global element", () => {
  return runCSS({
    fixture: ":global(input) {}",
    expected: "input {}"
  });
});

test("compile explict global attribute", () => {
  return runCSS({
    fixture: ':global([type="radio"]), :not(:global [type="radio"]) {}',
    expected: '[type="radio"], :not([type="radio"]) {}'
  });
});

test("throw on inconsistent selector result", () => {
  return runError({
    fixture: ":global .foo, .bar {}",
    error: /Inconsistent/
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

test("pass through global element", () => {
  return runCSS({
    fixture: "input {}",
    expected: "input {}"
  });
});

test("localise class and pass through element", () => {
  return runCSS({
    fixture: ".foo input {}",
    expected: ":local(.foo) input {}"
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
  return expect(compile(root).then(result => result.css)).resolves.toEqual(
    ":local(.a) {\n    :local(.b) {}\n}"
  );
});

test("not localize keyframes rules", () => {
  return runCSS({
    fixture: "@keyframes foo { from {} to {} }",
    expected: "@keyframes foo { from {} to {} }"
  });
});
