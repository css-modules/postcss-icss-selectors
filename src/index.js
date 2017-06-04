/* eslint-env node */
import postcss from "postcss";
import Tokenizer from "css-selector-tokenizer";

const plugin = "postcss-modules-local-by-default";

function normalizeNodeArray(nodes) {
  var array = [];
  nodes.forEach(function(x) {
    if (Array.isArray(x)) {
      normalizeNodeArray(x).forEach(function(item) {
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

  var newNodes;
  switch (node.type) {
    case "selector":
      newNodes = node.nodes.map(function(n) {
        return localizeNode(n, context);
      });
      node = Object.create(node);
      node.nodes = normalizeNodeArray(newNodes);
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

    case "pseudo-class":
      if (node.name === "local" || node.name === "global") {
        if (context.inside) {
          throw Error(
            "A :" +
              node.name +
              " is not allowed inside of a :" +
              context.inside +
              "(...)"
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
            "A :" +
              node.name +
              "(...) is not allowed inside of a :" +
              context.inside +
              "(...)"
          );
        }
        subContext = {
          global: node.name === "global",
          inside: node.name,
          hasLocals: false,
          explicit: true
        };
        node = node.nodes.map(function(n) {
          return localizeNode(n, subContext);
        });
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
        newNodes = node.nodes.map(function(n) {
          return localizeNode(n, subContext);
        });
        node = Object.create(node);
        node.nodes = normalizeNodeArray(newNodes);
      }
      if (subContext.hasLocals) {
        context.hasLocals = true;
      }
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

const localizeSelectors = (selectors, context) => {
  const node = Tokenizer.parse(selectors);
  var resultingGlobal;
  context.hasPureGlobals = false;
  const newNodes = node.nodes.map(function(n) {
    var nContext = {
      global: context.global,
      lastWasSpacing: true,
      hasLocals: false,
      explicit: false
    };
    n = localizeNode(n, nContext);
    if (typeof resultingGlobal === "undefined") {
      resultingGlobal = nContext.global;
    } else if (resultingGlobal !== nContext.global) {
      throw Error(
        `Inconsistent rule global/local result in rule "${Tokenizer.stringify(node)}" (multiple selectors must result in the same mode for the rule)`
      );
    }
    if (!nContext.hasLocals) {
      context.hasPureGlobals = true;
    }
    return n;
  });
  context.global = resultingGlobal;
  node.nodes = normalizeNodeArray(newNodes);
  return Tokenizer.stringify(node);
};

module.exports = postcss.plugin(plugin, (options = {}) => css => {
  if (
    options.mode &&
    options.mode !== "global" &&
    options.mode !== "local" &&
    options.mode !== "pure"
  ) {
    throw Error(
      'options.mode must be either "global", "local" or "pure" (default "local")'
    );
  }
  var pureMode = options.mode === "pure";
  var globalMode = options.mode === "global";
  css.walkRules(function(rule) {
    if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name)) {
      // ignore keyframe rules
      return;
    }
    var context = {
      options: options,
      global: globalMode,
      hasPureGlobals: false
    };
    try {
      const newSelector = localizeSelectors(rule.selector, context);
      if (pureMode && context.hasPureGlobals) {
        throw Error(
          `Selector "${rule.selector}" is not pure (pure selectors must contain at least one local class or id)`
        );
      }
      rule.selector = newSelector;
    } catch (e) {
      throw rule.error(e.message);
    }
  });
});
