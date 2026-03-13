/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-void */

function isConsoleCall(node) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (!callee || callee.type !== "MemberExpression") return false;
  if (
    callee.object?.type !== "Identifier" ||
    callee.object.name !== "console"
  ) {
    return false;
  }
  if (callee.property?.type !== "Identifier") {
    return false;
  }
  const allowedMethods = [
    "log",
    "warn",
    "error",
    "debug",
    "info",
    "trace",
    "table",
  ];
  return allowedMethods.includes(callee.property.name);
}

module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  root
    .find(j.CallExpression)
    .filter((path) => isConsoleCall(path.node))
    .forEach((path) => {
      const parent = path.parent?.node;
      if (parent?.type === "ExpressionStatement") {
        j(path.parent).remove();
        return;
      }

      if (parent?.type === "ReturnStatement") {
        parent.argument = null;
        return;
      }

      j(path).replaceWith(j.unaryExpression("void", j.literal(0)));
    });

  return root.toSource({ quote: "double" });
};

module.exports.parser = "tsx";
