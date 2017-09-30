var path = require('path')
var fs = require('fs')
var transformAst = require('transform-ast')
var convert = require('convert-source-map')
var through = require('through2')
var eos = require('end-of-stream')
var splicer = require('labeled-stream-splicer')
var pack = require('browser-pack')
var runParallel = require('run-parallel')
var transform = require('./transform')

// import function name used internally only, to rewrite `import()` calls
// so module-deps doesn't error out on them.
var importFunction = '_$browserifyDynamicImport'

var helperPath = require.resolve('./helper')
var parseOpts = {
  ecmaVersion: 9,
  allowReturnOutsideFunction: true
}

module.exports = function dynamicImportPlugin (b, opts) {
  b.transform(transform)
  b.on('reset', addHooks)
  b.on('factor.pipeline', function (file, pipeline) {
    pipeline.get('pack').unshift(createStream(b, opts))
  })
  addHooks()

  function addHooks () {
    b.pipeline.get('pack').unshift(createStream(b, opts))
  }
}

function createStream (b, opts) {
  var outputDir = opts.dir || './'
  var outname = opts.filename || function (bundle) {
    return 'bundle.' + bundle.id + '.js'
  }
  var createOutputStream = opts.output || function (bundleName) {
    return fs.createWriteStream(path.join(outputDir, bundleName))
  }
  var publicPath = opts.public || './'
  var receiverPrefix = opts.prefix || '__browserifyDynamicImport__'

  var rows = []
  var rowsById = Object.create(null)
  var imports = []

  return through.obj(onwrite, onend)

  function onwrite (row, enc, cb) {
    var result = transformAst(row.source, parseOpts, function (node) {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === importFunction) {
        processDynamicImport(row, node)
      }
    })

    row.transformable = result
    rows.push(row)
    rowsById[row.index] = row

    cb(null)
  }

  function onend (cb) {
    var self = this

    if (imports.length === 0) {
      for (var i = 0; i < rows.length; i++) {
        this.push(rows[i])
      }
      cb(null)
      return
    }

    // Ensure the main bundle exports the dynamic import helper etc.
    b._bpack.hasExports = true

    // Remove dynamic imports from row dependencies.
    imports.forEach(function (imp) {
      var row = getRow(imp.row)
      var dep = getRow(imp.dep)
      deleteValue(row.deps, dep.id)
      deleteValue(row.indexDeps, dep.index)
    })

    // Collect rows that should be in the main bundle.
    var mainRows = []
    rows.filter(function (row) { return row.entry }).forEach(function (row) {
      mainRows.push(row.index)
      gatherDependencyIds(row, mainRows)
    })

    // Find which rows belong in which dynamic bundle.
    var dynamicBundles = Object.create(null)
    imports.forEach(function (imp) {
      var row = getRow(imp.row)
      var depEntry = getRow(imp.dep)
      var node = imp.node
      if (mainRows.includes(depEntry.index)) {
        // this entry point is also non-dynamically required by the main bundle.
        // we should not move it into a dynamic bundle.
        node.update('Promise.resolve().then(function () { return require(' + JSON.stringify(depEntry.id) + ') })')
        row.deps[depEntry.id] = depEntry.id
        row.indexDeps[depEntry.id] = depEntry.index
        return
      }
      var depRows = gatherDependencyIds(depEntry).filter(function (id) {
        // If a row required by this dynamic bundle also already exists in the main bundle,
        // expose it from the main bundle and use it from there instead of including it in
        // both the main and the dynamic bundles.
        if (mainRows.includes(id)) {
          getRow(id).expose = true
          return false
        }
        return true
      })

      dynamicBundles[depEntry.index] = depRows
    })

    // No more source transforms after this point, save transformed source code
    rows.forEach(function (row) {
      if (row.transformable) {
        row.source = row.transformable.toString()
        if (b._options.debug) {
          row.source += '\n' + convert.fromObject(row.transformable.map).toComment()
        }
      }
    })

    var pipelines = Object.keys(dynamicBundles).map(function (entry) {
      return createPipeline.bind(null, entry, dynamicBundles[entry])
    })

    runParallel(pipelines, function (err, mappings) {
      if (err) return cb(err)
      mappings = mappings.reduce(function (obj, x) {
        obj[x.entry] = path.join(publicPath, x.filename)
        return obj
      }, {})

      var helperRow = rows.find(function (r) { return r.file === helperPath })
      helperRow.source = helperRow.source
        .replace('MAPPINGS', JSON.stringify(mappings))
        .replace('PREFIX', JSON.stringify(receiverPrefix))

      new Set(mainRows).forEach(function (id) {
        self.push(getRow(id))
      })

      cb(null)
    })
  }

  function createPipeline (entryId, depRows, cb) {
    var entry = getRow(entryId)
    var pipeline = splicer.obj([
      'pack', [ pack({ raw: true }) ],
      'wrap', []
    ])

    b.emit('import.pipeline', pipeline)

    var basename = outname(entry)
    var writer = pipeline.pipe(createOutputStream(basename, entry))
    writer.on('name', function (name) {
      basename = name
    })

    pipeline.write(makeDynamicEntryRow(entry))
    pipeline.write(entry)
    depRows.forEach(function (depId) {
      var dep = getRow(depId)
      pipeline.write(dep)
    })
    pipeline.end()

    pipeline.on('error', cb)
    writer.on('error', cb)
    eos(writer, function () {
      cb(null, { entry: entryId, filename: basename })
    })
  }

  function values (object) {
    return Object.keys(object).map(function (k) { return object[k] })
  }
  function gatherDependencyIds (row, arr) {
    var deps = values(row.indexDeps)
    arr = arr || []

    deps.forEach(function (id) {
      var dep = rowsById[id]
      if (!dep || arr.includes(dep.index)) {
        return
      }
      // not sure why this is needed yet,
      // sometimes `id` is the helper path and that doesnt exist at this point
      // in the rowsById map
      if (dep) {
        arr.push(dep.index)
        gatherDependencyIds(dep, arr)
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
    // If `importPath` was already a resolved dependency index (eg. thanks to bundle-collapser)
    // we should just use that
    if (resolved == null) {
      resolved = importPath
    }

    node.edit.update(importFunction + '(' + JSON.stringify(resolved) + ')')

    queueDynamicImport(row.index, resolved, node)
  }

  function getRow (id) {
    return rowsById[id]
  }

  // Create a proxy module that will call the dynamic bundle receiver function
  // with the dynamic entry point's exports.
  function makeDynamicEntryRow (entry) {
    return {
      id: 'entry' + entry.index,
      source: receiverPrefix + entry.index + '( require("a") )',
      entry: true,
      deps: { a: entry.id },
      indexDeps: { a: entry.index }
    }
  }
}

function deleteValue (obj, val) {
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (obj[i] === val) delete obj[i]
    }
  }
}
