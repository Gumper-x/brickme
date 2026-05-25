import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(scriptDir, '..')
const utilsDir = path.join(rootDir, 'packages', 'utils', 'src')
const docsDir = path.join(rootDir, 'apps', 'doc', 'content', '3.utils')

const sourceFileNames = (await fs.readdir(utilsDir))
  .filter((fileName) => fileName.endsWith('.ts') && fileName !== 'index.ts')
  .sort((left, right) => left.localeCompare(right))

const sourcePaths = sourceFileNames.map((fileName) => path.join(utilsDir, fileName))

const program = ts.createProgram(sourcePaths, {
  allowJs: false,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ESNext,
})

const checker = program.getTypeChecker()

await fs.mkdir(docsDir, { recursive: true })

for (const fileName of await fs.readdir(docsDir)) {
  if (fileName.endsWith('.md')) {
    await fs.unlink(path.join(docsDir, fileName))
  }
}

const pages = []

for (const sourcePath of sourcePaths) {
  const sourceFile = program.getSourceFile(sourcePath)

  if (!sourceFile) {
    continue
  }

  const exportDocs = extractExports(sourceFile)
  const slug = path.basename(sourcePath, '.ts')
  const title = humanizeSlug(slug)

  pages.push({
    exportDocs,
    slug,
    title,
  })
}

await fs.writeFile(path.join(docsDir, '.navigation.yml'), 'title: Utils\nicon: false\n')
await fs.writeFile(path.join(docsDir, 'index.md'), renderIndexPage(pages))

for (const [index, page] of pages.entries()) {
  const fileName = `${String(index + 1)}.${page.slug}.md`
  await fs.writeFile(path.join(docsDir, fileName), renderDocPage(page))
}

function extractExports(sourceFile) {
  const exportDocs = []

  for (const statement of sourceFile.statements) {
    if (!isExported(statement)) {
      continue
    }

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      exportDocs.push(getFunctionDoc(statement))
      continue
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          exportDocs.push(getVariableDoc(declaration))
        }
      }
      continue
    }

    if (
      (ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)) &&
      statement.name
    ) {
      exportDocs.push(getDeclarationDoc(statement.name))
    }
  }

  return exportDocs
}

function getFunctionDoc(declaration) {
  const identifier = declaration.name
  const symbol = checker.getSymbolAtLocation(identifier)
  const astSignature = renderCallableSignature(identifier.text, declaration, declaration.getSourceFile())

  if (!symbol) {
    return createFallbackDoc(identifier.text, astSignature || `${identifier.text}()`)
  }

  const signature = checker.getSignatureFromDeclaration(declaration)
  const signatureText = astSignature || (signature ? `${identifier.text}${checker.signatureToString(signature)}` : `${identifier.text}()`)

  return {
    description: normalizeDescription(symbol.getDocumentationComment(checker)),
    name: identifier.text,
    signature: signatureText,
    tags: normalizeTags(symbol.getJsDocTags()),
  }
}

function getVariableDoc(declaration) {
  const identifier = declaration.name
  const symbol = checker.getSymbolAtLocation(identifier)
  const initializer = declaration.initializer
  const astSignature = initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
    ? renderCallableSignature(identifier.text, initializer, declaration.getSourceFile())
    : ''

  if (!symbol) {
    return createFallbackDoc(identifier.text, astSignature || `const ${identifier.text}`)
  }

  const signature = initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
    ? checker.getSignatureFromDeclaration(initializer)
    : undefined
  const resolvedDeclaration = symbol.valueDeclaration ?? declaration
  const type = checker.getTypeOfSymbolAtLocation(symbol, resolvedDeclaration)
  const signatureText = astSignature || (signature
    ? `${identifier.text}${checker.signatureToString(signature)}`
    : `const ${identifier.text}: ${checker.typeToString(type)}`)

  return {
    description: normalizeDescription(symbol.getDocumentationComment(checker)),
    name: identifier.text,
    signature: signatureText,
    tags: normalizeTags(symbol.getJsDocTags()),
  }
}

function getDeclarationDoc(identifier) {
  const symbol = checker.getSymbolAtLocation(identifier)

  if (!symbol) {
    return createFallbackDoc(identifier.text, identifier.text)
  }

  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? identifier
  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration)

  return {
    description: normalizeDescription(symbol.getDocumentationComment(checker)),
    name: identifier.text,
    signature: checker.typeToString(type),
    tags: normalizeTags(symbol.getJsDocTags()),
  }
}

function createFallbackDoc(name, signature) {
  return {
    description: '',
    name,
    signature,
    tags: [],
  }
}

function isExported(statement) {
  const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined

  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function normalizeDescription(parts) {
  return ts.displayPartsToString(parts).trim()
}

function normalizeTags(tags) {
  return tags.map((tag) => ({
    name: tag.name,
    text: normalizeTagText(tag.text),
  }))
}

function normalizeTagText(text) {
  if (!text) {
    return ''
  }

  if (typeof text === 'string') {
    return text.trim()
  }

  return text
    .map((part) => part.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function humanizeSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function renderCallableSignature(name, declaration, sourceFile) {
  const typeParameters = declaration.typeParameters?.length
    ? `<${declaration.typeParameters.map((typeParameter) => typeParameter.getText(sourceFile)).join(', ')}>`
    : ''
  const parameters = declaration.parameters
    .map((parameter) => parameter.getText(sourceFile))
    .join(', ')
  const returnType = declaration.type ? `: ${declaration.type.getText(sourceFile)}` : ''

  return `${name}${typeParameters}(${parameters})${returnType}`
}

function renderIndexPage(pages) {
  const links = pages
    .map((page) => `- [${page.title}](/utils/${page.slug}) - ${page.exportDocs.length} export${page.exportDocs.length === 1 ? '' : 's'}`)
    .join('\n')

  return `---
title: Utils
description: Auto-generated API reference for @brickflow/utils source files.
---

# Utils

This section is auto-generated from \`packages/utils/src\`.

## Import

\`\`\`ts
import { ... } from '@brickflow/utils'
\`\`\`

## Files

${links}
`
}

function renderDocPage(page) {
  const importList = page.exportDocs.map((exportDoc) => exportDoc.name).join(', ')
  const members = page.exportDocs.map(renderExportDoc).join('\n\n')

  return `---
title: ${page.title}
description: Auto-generated API reference for packages/utils/src/${page.slug}.ts.
---

# ${page.title}

Source: \`packages/utils/src/${page.slug}.ts\`

## Import

\`\`\`ts
import { ${importList} } from '@brickflow/utils'
\`\`\`

## Exports

${members}
`
}

function renderExportDoc(exportDoc) {
  const description = exportDoc.description ? `${exportDoc.description}\n\n` : ''
  const tags = exportDoc.tags.length > 0
    ? `${exportDoc.tags.map((tag) => `- \`@${tag.name}\`${tag.text ? ` ${tag.text}` : ''}`).join('\n')}\n`
    : ''

  return `### ${exportDoc.name}

\`\`\`ts
${exportDoc.signature}
\`\`\`

${description}${tags}`.trimEnd()
}
