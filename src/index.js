/* eslint-env node */
import postcss from "postcss";
import Tokenizer from "css-selector-tokenizer";

const plugin = "postcss-modules-local-by-default";

function normalizeNodeArray(nodes) {
  var array = [];
  nodes.forEach(x => {
    if (Array.isArray(x)) {
      normalizeNodeArray(x).forEach(item => {
        array.push(item);
      });
    } else if (x) {
      array.push(x);
    }
  });
  if (array.length > 0 && array[array.length - 1].type === "spacing") {
    array.pop();
  }
  return array;
}

function localizeNode(node, context) {
  if (context.ignoreNextSpacing && node.type !== "spacing") {
    throw Error(`Missing whitespace after :${context.ignoreNextSpacing}`);
  }
  if (context.enforceNoSpacing && node.type === "spacing") {
    throw Error(`Missing whitespace before :${context.enforceNoSpacing}`);
  }

  switch (node.type) {
    case "selector":
      node.nodes = normalizeNodeArray(
        node.nodes.map(n => localizeNode(n, context))
      );
      break;

    case "spacing":
      if (context.ignoreNextSpacing) {
        context.ignoreNextSpacing = false;
        context.lastWasSpacing = false;
        context.enforceNoSpacing = false;
        return null;
      }
      context.lastWasSpacing = true;
      return node;

    case "operator":
      context.lastWasSpacing = true;
      return node;

    case "pseudo-class":
      if (node.name === "local" || node.name === "global") {
        if (context.inside) {
          throw Error(
            `A :${node.name} is not allowed inside of a :${context.inside}(...)`
          );
        }
        context.ignoreNextSpacing = context.lastWasSpacing ? node.name : false;
        context.enforceNoSpacing = context.lastWasSpacing ? false : node.name;
        context.global = node.name === "global";
        context.explicit = true;
        return null;
      }
      break;

    case "nested-pseudo-class":
      var subContext;
      if (node.name === "local" || node.name === "global") {
        if (context.inside) {
          throw Error(
            `A :${node.name}(...) is not allowed inside of a :${context.inside}(...)`
          );
        }
        subContext = {
          global: node.name === "global",
          inside: node.name,
          hasLocals: false,
          explicit: true
        };
        node = node.nodes.map(n => localizeNode(n, subContext));
        // don't leak spacing
        node[0].before = undefined;
        node[node.length - 1].after = undefined;
      } else {
        subContext = {
          global: context.global,
          inside: context.inside,
          lastWasSpacing: true,
          hasLocals: false,
          explicit: context.explicit
        };
        node.nodes = node.nodes.map(n => localizeNode(n, subContext));
      }
      context.hasLocals = subContext.hasLocals;
      break;

    case "id":
    case "class":
      if (!context.global) {
        node = {
          type: "nested-pseudo-class",
          name: "local",
          nodes: [node]
        };
        context.hasLocals = true;
      }
      break;
  }

  // reset context
  context.lastWasSpacing = false;
  context.ignoreNextSpacing = false;
  context.enforceNoSpacing = false;
  return node;
}

const localizeSelectors = (selectors, mode) => {
  const node = Tokenizer.parse(selectors);
  var resultingGlobal;
  node.nodes = node.nodes.map(n => {
    var nContext = {
      global: mode === "global",
      lastWasSpacing: true,
      hasLocals: false,
      explicit: false
    };
    n = localizeNode(n, nContext);
    if (typeof resultingGlobal === "undefined") {
      resultingGlobal = nContext.global;
    } else if (resultingGlobal !== nContext.global) {
      throw Error(
        `Inconsistent rule global/local result in rule "${Tokenizer.stringify(node)}"` +
          ` (multiple selectors must result in the same mode for the rule)`
      );
    }
    return n;
  });
  return Tokenizer.stringify(node);
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
