var path = require('path')
var fs = require('fs')
var crypto = require('crypto')
var transformAst = require('transform-ast')
var convert = require('convert-source-map')
var through = require('through2')
var to = require('flush-write-stream')
var eos = require('end-of-stream')
var splicer = require('labeled-stream-splicer')
var pack = require('browser-pack')
var runParallel = require('run-parallel')
var deleteValue = require('object-delete-value')
var isRequire = require('estree-is-require')
var outpipe = require('outpipe')
var dash = require('dash-ast')
var scan = require('scope-analyzer')
var acorn = require('acorn-node')

function mayContainSplitRequire (str) {
  return str.indexOf('split-require') !== -1
}

function detectSplitRequireCalls (ast, onreference, onrequire) {
  scan.crawl(ast)
  dash(ast, function (node) {
    var binding
    if (isRequire(node, 'split-require')) {
      if (onrequire) onrequire(node)
      if (node.parent.type === 'VariableDeclarator') {
        // var sr = require('split-require')
        binding = scan.getBinding(node.parent.id)
        if (binding) binding.getReferences().slice(1).forEach(onreference)
      } else if (node.parent.type === 'AssignmentExpression') {
        // sr = require('split-require')
        binding = scan.getBinding(node.parent.left)
        if (binding) binding.getReferences().slice(1).forEach(onreference)
      } else {
        // require('split-require')(...args)
        onreference(node)
      }
    }
  })
}

/**
 * A transform that adds an actual `require()` call to `split-require` calls.
 * This way module-deps can pick up on it.
 */
function transformSplitRequireCalls (file, opts) {
  var source = ''
  return through(onwrite, onend)
  function onwrite (chunk, enc, cb) {
    source += chunk
    cb(null, chunk)
  }
  function onend (cb) {
    if (!mayContainSplitRequire(source)) {
      cb()
      return
    }

    if (this.listenerCount('dep') === 0) {
      throw new Error('split-require requires browserify v16 or up')
    }

    var self = this
    var ast = acorn.parse(source)
    detectSplitRequireCalls(ast, function (node) {
      if (node.parent.type === 'CallExpression') {
        var arg = node.parent.arguments[0]
        self.emit('dep', arg.value)
      }
    })

    cb()
  }
}

module.exports = function splitRequirePlugin (b, opts) {
  // Run this globally because it needs to run last (and because it is cheap)
  b.transform(transformSplitRequireCalls, { global: true })
  b.on('reset', addHooks)

  addHooks()

  function addHooks () {
    b.pipeline.get('pack').unshift(createSplitter(b, opts))
  }
}

module.exports.createStream = createSplitter

function createSplitter (b, opts) {
  var outputDir = opts.out || opts.dir || './' // .dir is deprecated
  var fallbackBundleId = 1
  var outname = opts.filename || function (bundle) {
    var id = String(bundle.index || bundle.id)
    if (!/^[\w\d]+$/.test(id)) {
      id = fallbackBundleId++
    }
    return 'bundle.' + id + '.js'
  }
  var createOutputStream = opts.output || function (bundleName) {
    if (outputDir.indexOf('%f') !== -1) {
      return outpipe(outputDir.replace('%f', bundleName))
    }
    return fs.createWriteStream(path.join(outputDir, bundleName))
  }
  var publicPath = opts.public || './'

  var rows = []
  var rowsById = Object.create(null)
  var splitRequires = []
  var runtimeRow = null
  var runtimeId = null

  return through.obj(onwrite, onend)

  function onwrite (row, enc, cb) {
    if (mayContainSplitRequire(row.source)) {
      var ast = acorn.parse(row.source)
      row.transformable = transformAst(row.source, { ast: ast })
      detectSplitRequireCalls(ast, function (node) {
        if (node.parent.type === 'CallExpression' && node.parent.callee === node) {
          processSplitRequire(row, node.parent)
        }
      }, function (node) {
        // Mark the thing we imported as the runtime row.
        var importPath = getStringValue(node.arguments[0])
        runtimeId = row.deps[importPath]
        if (rowsById[runtimeId]) {
          runtimeRow = rowsById[runtimeId]
        }
      })
    }

    if (runtimeId && String(row.id) === String(runtimeId)) {
      runtimeRow = row
    }

    rows.push(row)
    rowsById[row.id] = row

    cb(null)
  }

  function onend (cb) {
    var self = this

    if (splitRequires.length === 0) {
      for (var i = 0; i < rows.length; i++) {
        this.push(rows[i])
      }
      cb(null)
      return
    }

    // Assume external?
    if (!runtimeRow && runtimeId) {
      runtimeRow = {
        id: runtimeId,
        index: runtimeId
      }
    }

    if (!runtimeRow) {
      cb(new Error('split-require: the split-require runtime helper was not bundled. Most likely this means that you are using two versions of split-require simultaneously.'))
      return
    }

    // Ensure the main bundle exports the helper etc.
    b._bpack.hasExports = true

    // Remove split modules from row dependencies.
    splitRequires.forEach(function (imp) {
      var row = getRow(imp.row)
      var dep = getRow(imp.dep)
      deleteValue(row.deps, dep.id)
      if (row.indexDeps) deleteValue(row.indexDeps, dep.index)
    })

    // Collect rows that should be in the main bundle.
    var mainRows = []
    rows.filter(function (row) { return row.entry }).forEach(function (row) {
      mainRows.push(row.id)
      gatherDependencyIds(row, mainRows)
    })

    // Find which rows belong in which dynamic bundle.
    var dynamicBundles = Object.create(null)
    splitRequires.forEach(function (imp) {
      var row = getRow(imp.row)
      var depEntry = getRow(imp.dep)
      var node = imp.node
      if (mainRows.indexOf(depEntry.id) !== -1) {
        // this entry point is also non-dynamically required by the main bundle.
        // we should not move it into a dynamic bundle.
        node.callee.edit.append('.t')
        // wrap this in a closure so we call `require()` asynchronously,
        // just like if it was actually dynamically loaded
        node.arguments[0].edit.prepend('function(){return require(').append(')}')

        // add the dependency back
        row.deps[depEntry.id] = depEntry.id
        if (row.indexDeps) row.indexDeps[depEntry.id] = depEntry.index
        return
      }
      var depRows = gatherDependencyIds(depEntry).filter(function (id) {
        // If a row required by this dynamic bundle also already exists in the main bundle,
        // expose it from the main bundle and use it from there instead of including it in
        // both the main and the dynamic bundles.
        if (mainRows.indexOf(id) !== -1) {
          getRow(id).expose = true
          return false
        }
        return true
      })

      dynamicBundles[depEntry.id] = depRows
    })

    // No more source transforms after this point, save transformed source code
    rows.forEach(function (row) {
      if (row.transformable) {
        row.source = row.transformable.toString()
        if (b._options.debug) {
          row.source += '\n' + convert.fromObject(row.transformable.map).toComment()
        }
        // leave no trace!
        delete row.transformable
      }
    })

    var pipelines = Object.keys(dynamicBundles).map(function (entry) {
      return createPipeline.bind(null, entry, dynamicBundles[entry])
    })

    runParallel(pipelines, function (err, mappings) {
      if (err) return cb(err)
      var sri = {}
      mappings = mappings.reduce(function (obj, x) {
        obj[x.entry] = path.join(publicPath, x.filename).replace(/\\/g, '/')
        if (x.integrity) sri[x.entry] = x.integrity
        return obj
      }, {})

      self.push(makeMappingsRow(mappings, sri))

      // Expose the `split-require` function so dynamic bundles can access it.
      runtimeRow.expose = true

      new Set(mainRows).forEach(function (id) {
        var row = getRow(id)
        // Move each other entry row by one, so our mappings are registered first.
        if (row.entry && typeof row.order === 'number') row.order++
        self.push(row)
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

    var basename = outname(entry)

    b.emit('split.pipeline', pipeline, entry, basename)

    var writer = pipeline.pipe(createOutputStream(basename, entry))
    // allow the output stream to assign a name asynchronously,
    // eg. one based on the hash of the bundle contents
    // the output stream is responsible for saving the file in the correct location
    writer.on('name', function (name) {
      basename = name
    })

    var ondone = done
    if (opts.sri) {
      ondone = after(2, ondone)
      var sri = createSri(opts.sri).on('error', cb)
      eos(pipeline.pipe(sri), ondone)
    }

    pipeline.on('error', cb)
    writer.on('error', cb)
    eos(writer, ondone)

    function done () {
      cb(null, {
        entry: entryId,
        filename: basename,
        integrity: opts.sri ? sri.value : null
      })
    }

    pipeline.write(makeDynamicEntryRow(entry))
    pipeline.write(entry)
    depRows.forEach(function (depId) {
      var dep = getRow(depId)
      pipeline.write(dep)
    })
    pipeline.end()
  }

  function gatherDependencyIds (row, arr) {
    var sortedDeps = Object.keys(row.deps).sort().map(function (key) {
      return row.deps[key]
    })
    arr = arr || []

    sortedDeps.forEach(function (id) {
      var dep = rowsById[id]
      if (!dep || arr.indexOf(dep.id) !== -1) {
        return
      }
      // not sure why this is needed yet,
      // sometimes `id` is the helper path and that doesnt exist at this point
      // in the rowsById map
      if (dep) {
        arr.push(dep.id)
        gatherDependencyIds(dep, arr)
      }
    })

    return arr
  }

  function queueSplitRequire (row, dep, node) {
    splitRequires.push({
      row: row,
      dep: dep,
      node: node
    })
  }

  function processSplitRequire (row, node) {
    // We need to get the `.arguments[0]` twice because at this point the call looks like
    // `splitRequire(require('xyz'))`
    var requirePath = node.arguments[0].value
    var resolved = row.deps[requirePath]
    // If `requirePath` was already a resolved dependency index (eg. thanks to bundle-collapser)
    // we should just use that
    if (resolved == null) {
      resolved = requirePath
    }

    node.arguments[0].edit.update(JSON.stringify(resolved))

    queueSplitRequire(row.id, resolved, node)
  }

  function getRow (id) {
    return rowsById[id]
  }

  // Create a module that registers the entry id → bundle filename mappings.
  function makeMappingsRow (mappings, integrity) {
    return {
      id: 'split_require_mappings',
      source: isEmpty(integrity) ? (
        'require("split-require").b = ' + JSON.stringify(mappings) + ';'
      ) : (
        'var sr = require("split-require");\n' +
        'sr.b = ' + JSON.stringify(mappings) + ';\n' +
        'sr.s = ' + JSON.stringify(integrity) + ';\n' +
        'sr.c = "anonymous";'
      ),
      entry: true,
      order: 0,
      deps: { 'split-require': runtimeRow.id },
      indexDeps: { 'split-require': runtimeRow.index }
    }
  }

  // Create a proxy module that will call the dynamic bundle receiver function
  // with the dynamic entry point's exports.
  function makeDynamicEntryRow (entry) {
    return {
      id: 'entry' + entry.id,
      source: 'require("split-require").l(' + JSON.stringify(entry.id) + ', require("a"));',
      entry: true,
      deps: {
        'split-require': runtimeRow.id,
        a: entry.id
      },
      indexDeps: {
        'split-require': runtimeRow.index,
        a: entry.index
      }
    }
  }
}
function createSri (type) {
  var hash = crypto.createHash(type)
  return to(ondata, onend)

  function ondata (chunk, enc, cb) {
    hash.update(chunk)
    cb()
  }
  function onend (cb) {
    this.value = type + '-' + hash.digest('base64')
    cb()
  }
}

function isEmpty (obj) {
  for (var i in obj) return false
  return true
}

function after (n, cb) {
  var i = 0
  return function () {
    if (++i === n) {
      cb()
    }
  }
}

function getStringValue (node) {
  if (node.type === 'Literal') return node.value
  if (node.type === 'TemplateLiteral' && node.quasis.length === 1) {
    return node.quasis[0].value.cooked
  }
}
