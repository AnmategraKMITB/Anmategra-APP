// Dua aturan dari eslint-plugin-drizzle 0.2.3 (Apache-2.0, Drizzle Team,
// https://github.com/drizzle-team/drizzle-orm/tree/main/eslint-plugin-drizzle),
// disalin tanpa ketergantungan pada `eslint` dan `@typescript-eslint/utils`
// supaya ESLint bisa dihapus. Logikanya sama dengan aslinya; dimuat oleh
// `bun lint` lewat `jsPlugins` di .oxlintrc.json.

function resolveMemberExpressionPath(node) {
  let objectExpression = node.object;
  let fullName = '';
  const addToFullName = (name) => {
    const prefix = fullName ? '.' : '';
    fullName = `${name}${prefix}${fullName}`;
  };
  while (objectExpression) {
    if (objectExpression.type === 'MemberExpression') {
      if (objectExpression.property.type === 'Identifier') {
        addToFullName(objectExpression.property.name);
      }
      objectExpression = objectExpression.object;
    } else if (
      objectExpression.type === 'CallExpression' &&
      objectExpression.callee.type === 'Identifier'
    ) {
      addToFullName(`${objectExpression.callee.name}(...)`);
      break;
    } else if (
      objectExpression.type === 'CallExpression' &&
      objectExpression.callee.type === 'MemberExpression'
    ) {
      if (objectExpression.callee.property.type === 'Identifier') {
        addToFullName(`${objectExpression.callee.property.name}(...)`);
      }
      objectExpression = objectExpression.callee.object;
    } else if (objectExpression.type === 'Identifier') {
      addToFullName(objectExpression.name);
      break;
    } else if (objectExpression.type === 'ThisExpression') {
      addToFullName('this');
      break;
    } else {
      break;
    }
  }
  return fullName;
}

function isDrizzleObjName(name, drizzleObjectName) {
  if (typeof drizzleObjectName === 'string') return name === drizzleObjectName;
  if (Array.isArray(drizzleObjectName)) {
    return drizzleObjectName.length === 0 || drizzleObjectName.includes(name);
  }
  return false;
}

function isDrizzleObj(node, drizzleObjectName) {
  if (node.object.type === 'Identifier') {
    return isDrizzleObjName(node.object.name, drizzleObjectName);
  }
  if (
    node.object.type === 'MemberExpression' &&
    node.object.property.type === 'Identifier'
  ) {
    return isDrizzleObjName(node.object.property.name, drizzleObjectName);
  }
  if (node.object.type === 'CallExpression') {
    if (node.object.callee.type === 'Identifier') {
      return isDrizzleObjName(node.object.callee.name, drizzleObjectName);
    }
    if (
      node.object.callee.type === 'MemberExpression' &&
      node.object.callee.property.type === 'Identifier'
    ) {
      return isDrizzleObjName(
        node.object.callee.property.name,
        drizzleObjectName,
      );
    }
  }
  return false;
}

const schema = [
  {
    type: 'object',
    properties: { drizzleObjectName: { type: ['string', 'array'] } },
    additionalProperties: false,
  },
];

const objectName = (context) => context.options[0]?.drizzleObjectName ?? [];

// Seperti aslinya: nama member terakhir yang dikunjungi. Untuk
// `db.delete(t).where(x)` member `.where` dikunjungi sebelum `.delete`.
let lastNodeName = '';

const enforceDeleteWithWhere = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that `delete` method is used with `where` to avoid deleting all the rows in a table.',
    },
    messages: {
      enforceDeleteWithWhere:
        "Without `.where(...)` you will delete all the rows in a table. If you didn't want to do it, please use `{{ drizzleObjName }}.delete(...).where(...)` instead. Otherwise you can ignore this rule here",
    },
    schema,
  },
  create(context) {
    const names = objectName(context);
    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        if (
          node.property.name === 'delete' &&
          lastNodeName !== 'where' &&
          isDrizzleObj(node, names)
        ) {
          context.report({
            node,
            messageId: 'enforceDeleteWithWhere',
            data: { drizzleObjName: resolveMemberExpressionPath(node) },
          });
        }
        lastNodeName = node.property.name;
      },
    };
  },
};

const enforceUpdateWithWhere = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that `update` method is used with `where` to avoid deleting all the rows in a table.',
    },
    messages: {
      enforceUpdateWithWhere:
        "Without `.where(...)` you will update all the rows in a table. If you didn't want to do it, please use `{{ drizzleObjName }}.update(...).set(...).where(...)` instead. Otherwise you can ignore this rule here",
    },
    schema,
  },
  create(context) {
    const names = objectName(context);
    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        if (
          lastNodeName !== 'where' &&
          node.property.name === 'set' &&
          node.object.type === 'CallExpression' &&
          node.object.callee.type === 'MemberExpression' &&
          node.object.callee.property.type === 'Identifier' &&
          node.object.callee.property.name === 'update' &&
          isDrizzleObj(node.object.callee, names)
        ) {
          context.report({
            node,
            messageId: 'enforceUpdateWithWhere',
            data: {
              drizzleObjName: resolveMemberExpressionPath(node.object.callee),
            },
          });
        }
        lastNodeName = node.property.name;
      },
    };
  },
};

export default {
  meta: { name: 'drizzle' },
  rules: {
    'enforce-delete-with-where': enforceDeleteWithWhere,
    'enforce-update-with-where': enforceUpdateWithWhere,
  },
};
