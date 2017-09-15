var path = require('path')
var fs = require('fs')
var transformAst = require('transform-ast')
var babylon = require('babylon')
var through = require('through2')
var splicer = require('labeled-stream-splicer')
var pack = require('browser-pack')

var importFunction = '_$browserifyDynamicImport'
var helperPath = 'browserify-dynamic-import/helper'
var parseOpts = {
  parser: babylon,
  ecmaVersion: 9,
  allowReturnOutsideFunction: true
}

function helper (mappings, prefix) {
  var cache = Object.create(null)
  return function load (index) {
    if (cache[index]) return cache[index]
    var url = mappings[index]
    var receiver = prefix + index
    return cache[index] = new Promise(function (resolve, reject) {
      window[receiver] = resolve
      var s = document.createElement('script')
      s.async = true
      s.type = 'application/javascript'
      s.src = url
      s.onerror = function () {
        reject(new Error('Failed to load'))
      }
      document.body.appendChild(s)
    })
  }
}

function transform (file, opts) {
  var source = ''
  return through(onwrite, onend)
  function onwrite (chunk, enc, next) {
    source += chunk
    next()
  }
  function onend (next) {
    var result = transformAst(source, Object.assign({}, parseOpts, {
      sourceType: 'module',
      plugins: ['dynamicImport']
    }), function (node) {
      if (node.type === 'Import') {
        node.edit.update('require')
        node.parent.edit
          .prepend(importFunction + '(')
          .append(')')
      }
    })
    next(null, result.toString())
  }
}

module.exports = function dynamicImportPlugin (b, opts) {
  var outputDir = opts.dir || './'
  var outname = function (chunk) {
    return 'chunk.' + chunk + '.js'
  }
  var receiverPrefix = opts.prefix || '__browserifyDynamicImport__'

  var rows = []
  var rowsById = Object.create(null)
  var imports = []
  b.transform(transform, {
    global: true,
    browserify: b
  })
  b.pipeline.get('label').push(through.obj(onwrite, onend))

  b._bpack.hasExports = true

  function onwrite (row, enc, cb) {
    var hasImport = false
    var result = transformAst(row.source, parseOpts, function (node) {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === importFunction) {
        processDynamicImport(row, node)
        hasImport = true
      }

      if (node.type === 'Program' && hasImport) {
        node.prepend('var _$import = require(' + JSON.stringify(helperPath) + ');\n')
        row.deps[helperPath] = helperPath
        row.indexDeps[helperPath] = helperPath
      }
    })

    row.source = result.toString()
    rows.push(row)
    rowsById[row.index] = row

    cb(null)
  }
  function onend (cb) {
    var pipelines = []
    var mappings = {}
    for (var i = 0; i < imports.length; i++) {
      var row = rowsById[imports[i].row]
      var dep = rowsById[imports[i].dep]
      var node = imports[i].node
      var depRows = gatherDependencies(dep)
      deleteValue(row.deps, dep.id)
      deleteValue(row.indexDeps, dep.index)

      var chunkName = outname(dep.index)
      mappings[dep.index] = chunkName

      pipelines.push({
        entry: dep,
        rows: depRows
      })
    }

    rows.unshift({
      id: helperPath,
      index: helperPath,
      source: `module.exports = (${helper})(${JSON.stringify(mappings)}, ${JSON.stringify(receiverPrefix)})`,
      deps: {},
      indexDeps: {}
    })
    rowsById[helperPath] = rows[0]

    function deleteValue (obj, val) {
      for (var i in obj) if (obj.hasOwnProperty(i)) {
        if (obj[i] === val) delete obj[i]
      }
    }

    var mainRows = []
    rows.filter(function (row) { return row.entry }).forEach(function (row) {
      mainRows.push(row.index)
      gatherDependencies(row, mainRows)
    })

    pipelines.forEach(function (pipeline) {
      pipeline.rows = pipeline.rows.filter(function (id) {
        if (mainRows.includes(id)) {
          rowsById[id].expose = true
          return false
        }
        return true
      })

      createPipeline(pipeline.entry, pipeline.rows)
    })

    new Set(mainRows).forEach(function (id) {
      this.push(rowsById[id])
    }, this)

    cb(null)
  }

  function createPipeline (entry, depRows) {
    var pipeline = splicer.obj([
      'pack', [ pack({ raw: true }) ],
      'wrap', []
    ])

    b.emit('import.pipeline', pipeline)

    pipeline.pipe(fs.createWriteStream(path.join( outputDir, outname(entry.index) )))

    pipeline.write({
      id: 'entry' + entry.index,
      source: receiverPrefix + entry.index + '( require("a") )',
      entry: true,
      deps: { a: entry.id },
      indexDeps: { a: entry.index }
    })
    pipeline.write(entry)
    depRows.forEach(function (depId) {
      var dep = rowsById[depId]
      pipeline.write(dep)
    })
    pipeline.end()
  }

  function gatherDependencies (row, arr) {
    var deps = Object.values(row.indexDeps)
    arr = arr || []
    arr.push(...deps)

    deps.forEach(function (id) {
      var dep = rowsById[id]
      gatherDependencies(dep, arr)
    })

    return arr
  }

  function queueDynamicImport (row, dep, node) {
    imports.push({
      row: row,
      dep: dep,
      node: node
    })
  }

  function processDynamicImport (row, node) {
    var importPath = node.arguments[0].arguments[0].value
    var resolved = row.indexDeps[importPath]
    node.edit.update('_$import(' + JSON.stringify(resolved) + ')')

    queueDynamicImport(row.index, resolved, node)
  }
}
