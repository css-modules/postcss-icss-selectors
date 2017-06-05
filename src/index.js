/* eslint-env node */
import postcss from "postcss";
import Tokenizer from "css-selector-tokenizer";

const plugin = "postcss-modules-local-by-default";

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

function localizeNode(node, { mode, inside }) {
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
            ...localizeNode(n.nodes[0], { mode: n.name, inside: n.name }).nodes
          ];
        } else {
          return [
            ...acc,
            Object.assign({}, n, {
              nodes: localizeNode(n.nodes[0], { mode, inside }).nodes
            })
          ];
        }

      case "id":
      case "class":
        if (mode === "local") {
          return [
            ...acc,
            {
              type: "nested-pseudo-class",
              name: "local",
              nodes: [n]
            }
          ];
        }
        return [...acc, n];

      default:
        return [...acc, n];
    }
  }, []);

  return Object.assign({}, node, { nodes: trimNodes(newNodes) });
}

const localizeSelectors = (selectors, mode) => {
  const node = Tokenizer.parse(selectors);
  return Tokenizer.stringify(
    Object.assign({}, node, {
      nodes: node.nodes.map(n => localizeNode(n, { mode }))
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

module.exports = postcss.plugin(plugin, (options = {}) => css => {
  walkRules(css, rule => {
    try {
      rule.selector = localizeSelectors(
        rule.selector,
        options.mode === "global" ? "global" : "local"
      );
    } catch (e) {
      throw rule.error(e.message);
    }
  });
});
