const isUpperCase = (name) => name && name === name.toUpperCase()

const isSpecialChars = (name) => name && /^[$_]$/.test(name)

const isCalleeRequire = (init) => {
  return init && init.callee && init.callee.name === 'require'
}

const isInitTypeLiteral = (init) => init && init.type === 'Literal'

const isInitTypeNegativeLiteral = (init) =>
  init && init.type === 'UnaryExpression' && init.operator === '-' && init.argument.type === 'Literal'

const isLiteral = (init) =>
  isInitTypeLiteral(init) || isInitTypeNegativeLiteral(init) || isInitTypeBinaryExpression(init)

function isInitTypeBinaryExpression(init) {
  return (
    init &&
    init.type === 'BinaryExpression' &&
    ['*', '+', '-', '/'].includes(init.operator) &&
    isLiteral(init.left) &&
    isLiteral(init.right)
  )
}

const messages = {
  lower: 'const/let should be in lower case',
  upper: 'const should be in upper case',
}

const rule = {
  create: ({ report }) => ({
    VariableDeclaration: (node) => {
      if (node.kind === 'const') {
        node.declarations.forEach(({ id: { name }, init }) => {
          if (!isUpperCase(name) && isLiteral(init)) {
            report({ message: messages.upper, node })
          }

          if (isUpperCase(name) && !isLiteral(init) && !isCalleeRequire(init) && !isSpecialChars(name)) {
            report({ message: messages.lower, node })
          }
        })
      }

      if (node.kind === 'let') {
        node.declarations.forEach(({ id: { name }, init }) => {
          if (isUpperCase(name) && !isCalleeRequire(init) && !isSpecialChars(name)) {
            report({ message: messages.lower, node })
          }
        })
      }
    },
  }),
}

export default rule
