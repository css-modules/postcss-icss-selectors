/* eslint-env node */
import postcss from "postcss";
import Tokenizer from "css-selector-tokenizer";
import { extractICSS, createICSSRules } from "icss-utils";
import genericNames from "generic-names";

const plugin = "postcss-icss-selectors";

const trimNodes = nodes => {
  const firstIndex = nodes.findIndex(node => node.type !== "spacing");
  const lastIndex = nodes
    .slice()
    .reverse()
    .findIndex(node => node.type !== "spacing");
  return nodes.slice(firstIndex, nodes.length - lastIndex);
};

const isSpacing = node => node.type === "spacing" || node.type === "operator";

const isModifier = node =>
  node.type === "pseudo-class" &&
  (node.name === "local" || node.name === "global");

function localizeNode(node, { mode, inside, getAlias }) {
  const newNodes = node.nodes.reduce((acc, n, index, nodes) => {
    switch (n.type) {
      case "spacing":
        if (isModifier(nodes[index + 1])) {
          return [...acc, Object.assign({}, n, { value: "" })];
        }
        return [...acc, n];

      case "operator":
        if (isModifier(nodes[index + 1])) {
          return [...acc, Object.assign({}, n, { after: "" })];
        }
        return [...acc, n];

      case "pseudo-class":
        if (isModifier(n)) {
          if (inside) {
            throw Error(
              `A :${n.name} is not allowed inside of a :${inside}(...)`
            );
          }
          if (index !== 0 && !isSpacing(nodes[index - 1])) {
            throw Error(`Missing whitespace before :${n.name}`);
          }
          if (index !== nodes.length - 1 && !isSpacing(nodes[index + 1])) {
            throw Error(`Missing whitespace after :${n.name}`);
          }
          // set mode
          mode = n.name;
          return acc;
        }
        return [...acc, n];

      case "nested-pseudo-class":
        if (n.name === "local" || n.name === "global") {
          if (inside) {
            throw Error(
              `A :${n.name}(...) is not allowed inside of a :${inside}(...)`
            );
          }
          return [
            ...acc,
            ...localizeNode(n.nodes[0], {
              mode: n.name,
              inside: n.name,
              getAlias
            }).nodes
          ];
        } else {
          return [
            ...acc,
            Object.assign({}, n, {
              nodes: localizeNode(n.nodes[0], { mode, inside, getAlias }).nodes
            })
          ];
        }

      case "id":
      case "class":
        if (mode === "local") {
          return [...acc, Object.assign({}, n, { name: getAlias(n.name) })];
        }
        return [...acc, n];

      default:
        return [...acc, n];
    }
  }, []);

  return Object.assign({}, node, { nodes: trimNodes(newNodes) });
}

const localizeSelectors = (selectors, mode, getAlias) => {
  const node = Tokenizer.parse(selectors);
  return Tokenizer.stringify(
    Object.assign({}, node, {
      nodes: node.nodes.map(n => localizeNode(n, { mode, getAlias }))
    })
  );
};

const walkRules = (css, callback) => {
  css.walkRules(rule => {
    if (rule.parent.type !== "atrule" || !/keyframes$/.test(rule.parent.name)) {
      callback(rule);
    }
  });
};

const addExports = (css, aliases) => {
  const { icssImports, icssExports } = extractICSS(css);
  const exports = Object.assign({}, icssExports, aliases);
  css.prepend(createICSSRules(icssImports, exports));
};

const getMessages = aliases =>
  Object.keys(aliases)
    .map(name => ({ plugin, type: "icss-scoped", name, value: aliases[name] }))
    .reduce((acc, msg) => [...acc, msg], []);

const isValue = (messages, name) =>
  messages.find(msg => msg.type === "icss-value" && msg.value === name);

const isRedeclared = (messages, name) =>
  messages.find(msg => msg.type === "icss-scoped" && msg.name === name);

const getComposed = (messages, name) =>
  messages
    .filter(msg => msg.type === "icss-composed" && msg.name === name)
    .map(msg => msg.value);

const composeAliases = (aliases, messages) =>
  Object.keys(aliases).reduce(
    (acc, name) =>
      Object.assign({}, acc, {
        [name]: [aliases[name], ...getComposed(messages, name)].join(" ")
      }),
    {}
  );

module.exports = postcss.plugin(plugin, (options = {}) => (css, result) => {
  const generateScopedName =
    options.generateScopedName ||
    genericNames("[name]__[local]---[hash:base64:5]");
  const input = (css && css.source && css.source.input) || {};
  const aliases = {};
  walkRules(css, rule => {
    const getAlias = name => {
      if (aliases[name]) {
        return aliases[name];
      }
      // icss-value contract
      if (isValue(result.messages, name)) {
        return name;
      }
      const alias = generateScopedName(name, input.from, input.css);
      // icss-scoped contract
      if (isRedeclared(result.messages, name)) {
        result.warn(`'${name}' already declared`, { node: rule });
      }
      aliases[name] = alias;
      return alias;
    };
    try {
      rule.selector = localizeSelectors(
        rule.selector,
        options.mode === "global" ? "global" : "local",
        getAlias
      );
    } catch (e) {
      throw rule.error(e.message);
    }
  });
  result.messages.push(...getMessages(aliases));
  // icss-composed contract
  addExports(css, composeAliases(aliases, result.messages));
});
