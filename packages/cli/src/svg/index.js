import fs from 'fs'
import { globSync } from 'glob'
import { optimize } from 'svgo'
console.log('\x1b[32m', '\rSVG Optimize')
const svgList = globSync('./**/*.svg')

for (let i = 0; i < svgList.length; i++) {
  const svgPath = svgList[i]
  const svg = fs.readFileSync(svgPath, 'utf8')
  const svgOptimized = optimize(svg, {
    js2svg: {
      indent: '',
      pretty: true,
    },
    path: svgPath,
    plugins: [
      // "addAttributesToSVGElement", // adds attributes to an outer <svg> element
      // "addClassesToSVGElement", // add classnames to an outer <svg> element
      'cleanupAttrs', // cleanup attributes from newlines, trailing, and repeating spaces Yes
      'cleanupEnableBackground', // remove or cleanup enable-background attribute when possible Yes
      'cleanupIds', // remove unused and minify used IDs Yes
      'cleanupListOfValues', // round numeric values in attributes that take a list of numbers (like viewBox or enable-background)
      'cleanupNumericValues', // round numeric values to the fixed precision, remove default px units Yes
      'collapseGroups', // collapse useless groups Yes
      'convertColors', // convert colors (from rgb() to #rrggbb, from #rrggbb to #rgb) Yes
      'convertEllipseToCircle', // convert non-eccentric <ellipse> to <circle> Yes
      'convertPathData', // convert Path data to relative or absolute (whichever is shorter), convert one segment to another, trim useless delimiters, smart rounding, and much more Yes
      'convertShapeToPath', // convert some basic shapes to <path> Yes
      'convertStyleToAttrs', // convert styles into attributes
      'convertTransform', // collapse multiple transforms into one, convert matrices to the short aliases, and much more Yes
      'inlineStyles', // move and merge styles from <style> elements to element style attributes Yes
      'mergePaths', // merge multiple Paths into one Yes
      'mergeStyles', // merge multiple style elements into one Yes
      'minifyStyles', // minify <style> elements content with CSSO Yes
      'moveElemsAttrsToGroup', // move elements' attributes to their enclosing group Yes
      'moveGroupAttrsToElems', // move some group attributes to the contained elements Yes
      'prefixIds', // prefix IDs and classes with the SVG filename or an arbitrary string
      // "removeAttributesBySelector", // removes attributes of elements that match a CSS selector
      // "removeAttrs", // remove attributes by pattern
      'removeComments', // remove comments Yes
      'removeDesc', // remove <desc> Yes
      'removeDimensions', // remove width/height and add viewBox if it's missing (opposite to removeViewBox, disable it first)
      'removeDoctype', // remove doctype declaration Yes
      'removeEditorsNSData', // remove editors namespaces, elements, and attributes Yes
      'removeElementsByAttr', // remove arbitrary elements by ID or className
      'removeEmptyAttrs', // remove empty attributes Yes
      'removeEmptyContainers', // remove empty Container elements Yes
      'removeEmptyText', // remove empty Text elements Yes
      'removeHiddenElems', // remove hidden elements Yes
      'removeMetadata', // remove <metadata> Yes
      'removeNonInheritableGroupAttrs', // remove non-inheritable group's "presentation" attributes Yes
      'removeOffCanvasPaths', // removes elements that are drawn outside of the viewbox
      'removeRasterImages', // remove raster images
      'removeScripts', // remove <script> elements
      // "removeStyleElement", // remove <style> elements
      'removeTitle', // remove <title> Yes
      'removeUnknownsAndDefaults', // remove unknown elements content and attributes, remove attributes with default values Yes
      'removeUnusedNS', // remove unused namespaces declaration Yes
      'removeUselessDefs', // remove elements of <defs> without id Yes
      'removeUselessStrokeAndFill', // remove useless stroke and fill attributes Yes
      // "removeViewBox", // remove viewBox attribute when possible Yes
      // "removeXMLNS", // removes the xmlns attribute (for inline SVG)
      'removeXMLProcInst', // remove XML processing instructions Yes
      'reusePaths', // Find duplicated elements and replace them with links
      'sortAttrs', // sort element attributes for epic readability Yes
      'sortDefsChildren', // sort children of <defs> in order to improve compression Yes
    ],
  })
  fs.writeFileSync(svgPath, svgOptimized.data)
  const percent = Math.round(((i + 1) * 100) / svgList.length)
  process.stdout.write(`\r🔅 Optimizing: [${'🌹'.repeat((percent * 10) / 100)}]  ${percent}%`)
}
console.log('\x1b[0m', '')
