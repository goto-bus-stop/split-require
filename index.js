var path = require('path')
var fs = require('fs')
var transformAst = require('transform-ast')
var babylon = require('babylon')
var through = require('through2')
var splicer = require('labeled-stream-splicer')
var pack = require('browser-pack')

// import function name used internally only, to rewrite `import()` calls
// so module-deps doesn't error out on them.
var importFunction = '_$browserifyDynamicImport'

var helperPath = require.resolve('./helper')
var parseOpts = {
  parser: babylon,
  ecmaVersion: 9,
  allowReturnOutsideFunction: true
}

function transform (file, opts) {
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
        var relative = path.relative(path.dirname(file), helperPath)
        node.prepend('var ' + importFunction + ' = require(' + JSON.stringify(relative) + ');\n')
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
  b.transform(transform, { global: true })
  b.pipeline.get('label').push(through.obj(onwrite, onend))

  b._bpack.hasExports = true

  function onwrite (row, enc, cb) {
    var result = transformAst(row.source, parseOpts, function (node) {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === importFunction) {
        processDynamicImport(row, node)
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

    var helperRow = rows.find(function (r) { return r.file === helperPath })
    helperRow.source = helperRow.source
      .replace('MAPPINGS', JSON.stringify(mappings))
      .replace('PREFIX', JSON.stringify(receiverPrefix))

    function deleteValue (obj, val) {
      for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
          if (obj[i] === val) delete obj[i]
        }
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

    var filename = path.join(outputDir, outname(entry.index))
    pipeline.pipe(fs.createWriteStream(filename))

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

  function values (object) {
    return Object.keys(object).map(function (k) { return object[k] })
  }
  function gatherDependencies (row, arr) {
    var deps = values(row.indexDeps)
    arr = arr || []
    arr.push.apply(arr, deps)

    deps.forEach(function (id) {
      var dep = rowsById[id]
      // not sure why this is needed yet,
      // sometimes `id` is the helper path and that doesnt exist at this point
      // in the rowsById map
      if (dep) {
        gatherDependencies(dep, arr)
      }
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
    node.edit.update(importFunction + '(' + JSON.stringify(resolved) + ')')

    queueDynamicImport(row.index, resolved, node)
  }
}
