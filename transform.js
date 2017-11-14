var through = require('through2')
var transformAst = require('transform-ast')
var babylon = require('babylon')
var convert = require('convert-source-map')

var parseOpts = {
  parser: babylon,
  ecmaVersion: 9,
  allowReturnOutsideFunction: true
}

/**
 * Transform that rewrites `import()` to `split-require` calls.
 * Do not use as a standalone transform, only with the plugin!
 */

module.exports = function transform (file, opts) {
  var source = ''
  return through(onwrite, onend)
  function onwrite (chunk, enc, next) {
    source += chunk
    next()
  }
  function onend (next) {
    var moduleOpts = Object.assign({}, parseOpts, {
      sourceType: 'module',
      plugins: ['dynamicImport']
    })
    var hasImport = false
    var importFunction = 'splitRequire'
    var suffix = 0
    while (source.includes(importFunction)) {
      importFunction = 'splitRequire' + (suffix++)
    }

    var result = transformAst(source, moduleOpts, function (node) {
      if (node.type === 'Import') {
        // rewrite to require() call to make module-deps pick up on this
        node.edit.update('require')
        node.parent.edit
          .prepend(importFunction + '(')
          .append(')')
        hasImport = true
      }
      if (node.type === 'Program' && hasImport) {
        node.prepend('var ' + importFunction + ' = require("split-require");\n')
      }
    })

    var transformed = result.toString()
    if (opts._flags && opts._flags.debug) {
      transformed += '\n' + convert.fromObject(result.map).toComment()
    }
    next(null, transformed)
  }
}
