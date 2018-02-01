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
var values = require('object-values')
var isRequire = require('estree-is-require')
var outpipe = require('outpipe')

var parseOpts = {
  parser: require('acorn-node')
}

var runtimePath = require.resolve('./browser')
// Used to tag nodes that are splitRequire() calls.
var kIsSplitRequireCall = Symbol('is split-require call')

function mayContainSplitRequire (str) {
  return str.indexOf('split-require') !== -1
}

function createSplitRequireDetector () {
  var splitVariables = []

  return {
    visit: visit,
    check: check
  }

  function visit (node) {
    if (isRequire(node, 'split-require')) {
      if (node.parent.type === 'VariableDeclarator') {
        splitVariables.push(node.parent.id.name)
      }
      if (node.parent.type === 'AssignmentExpression') {
        splitVariables.push(node.parent.left.name)
      }
      // require('split-require')(...args)
      if (node.parent.type === 'CallExpression') {
        node.parent[kIsSplitRequireCall] = true
      }
      return true
    }
    // var sr = require('split-require'); sr(...args)
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && check(node.callee.name)) {
      node[kIsSplitRequireCall] = true
    }
    return false
  }

  function check (name) {
    return splitVariables.indexOf(name) !== -1
  }
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
    cb(null)
  }
  function onend (cb) {
    if (!mayContainSplitRequire(source)) {
      cb(null, source)
      return
    }

    var splitVariables = createSplitRequireDetector()
    var hasSplitRequireCall = false
    var result = transformAst(source, parseOpts, function (node) {
      splitVariables.visit(node)

      if (node[kIsSplitRequireCall]) {
        var arg = node.arguments[0]
        arg.edit.prepend('require(').append(')')
        hasSplitRequireCall = true
      }
    })

    // Pass through unchanged.
    if (!hasSplitRequireCall) {
      return cb(null, source)
    }

    var text = result.toString()
    if (opts && opts._flags && opts._flags.debug) {
      text += '\n' + convert.fromObject(result.map).toComment()
    }
    cb(null, text)
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

  return through.obj(onwrite, onend)

  function onwrite (row, enc, cb) {
    if (mayContainSplitRequire(row.source)) {
      var splitVariables = createSplitRequireDetector()
      var result = transformAst(row.source, parseOpts, function (node) {
        splitVariables.visit(node)

        if (node[kIsSplitRequireCall]) {
          processSplitRequire(row, node)
        }
      })

      row.transformable = result
    }

    if (row.file === runtimePath) {
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
        obj[x.entry] = path.join(publicPath, x.filename)
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

    b.emit('split.pipeline', pipeline)

    var basename = outname(entry)
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
    var deps = values(row.deps)
    arr = arr || []

    deps.forEach(function (id) {
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
    var requirePath = node.arguments[0].arguments[0].value
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
