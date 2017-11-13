var path = require('path')
var fs = require('fs')
var transformAst = require('transform-ast')
var convert = require('convert-source-map')
var through = require('through2')
var eos = require('end-of-stream')
var splicer = require('labeled-stream-splicer')
var pack = require('browser-pack')
var runParallel = require('run-parallel')
var deleteValue = require('object-delete-value')

var parseOpts = {
  ecmaVersion: 9,
  allowReturnOutsideFunction: true
}

var runtimePath = require.resolve('./browser')
// Used to tag nodes that are splitRequire() calls.
var kIsSplitRequireCall = Symbol('is split-require call')

function mayContainSplitRequire (str) {
  return str.includes('split-require')
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
    return splitVariables.includes(name)
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
    var result = transformAst(source, parseOpts, function (node) {
      splitVariables.visit(node)

      if (node[kIsSplitRequireCall]) {
        var arg = node.arguments[0]
        arg.edit.prepend('require(').append(')')
      }
    })

    cb(null, result + '')
  }
}

module.exports = function splitRequirePlugin (b, opts) {
  b.transform(transformSplitRequireCalls)
  b.on('reset', addHooks)

  addHooks()

  function addHooks () {
    b.pipeline.get('pack').unshift(createSplitter(b, opts))
  }
}

module.exports.createStream = createSplitter

function createSplitter (b, opts) {
  var outputDir = opts.dir || './'
  var outname = opts.filename || function (bundle) {
    return 'bundle.' + bundle.id + '.js'
  }
  var createOutputStream = opts.output || function (bundleName) {
    return fs.createWriteStream(path.join(outputDir, bundleName))
  }
  var publicPath = opts.public || './'

  var rows = []
  var rowsById = Object.create(null)
  var splitRequires = []

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

    rows.push(row)
    rowsById[row.index] = row

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

    // Ensure the main bundle exports the helper etc.
    b._bpack.hasExports = true

    // Remove split modules from row dependencies.
    splitRequires.forEach(function (imp) {
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
    splitRequires.forEach(function (imp) {
      var row = getRow(imp.row)
      var depEntry = getRow(imp.dep)
      var node = imp.node
      if (mainRows.includes(depEntry.index)) {
        // this entry point is also non-dynamically required by the main bundle.
        // we should not move it into a dynamic bundle.
        node.callee.edit.append('.t')
        node.arguments[0].edit.prepend('function(){return require(').append(')}')
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

      self.push(makeMappingsRow(mappings))

      // Expose the `split-require` function so dynamic bundles can access it.
      var runtimeRow = rows.find(function (row) {
        return row.file === runtimePath
      })
      runtimeRow.expose = true

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

    b.emit('split.pipeline', pipeline)

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
    var resolved = row.indexDeps[requirePath]
    // If `requirePath` was already a resolved dependency index (eg. thanks to bundle-collapser)
    // we should just use that
    if (resolved == null) {
      resolved = requirePath
    }

    node.arguments[0].edit.update(JSON.stringify(resolved))

    queueSplitRequire(row.index, resolved, node)
  }

  function getRow (id) {
    return rowsById[id]
  }

  // Create a module that registers the entry id → bundle filename mappings.
  function makeMappingsRow (mappings) {
    var runtimeRow = rows.find(function (row) {
      return row.file === runtimePath
    })

    return {
      id: 'split_require_mappings',
      source: 'require("split-require").b = ' + JSON.stringify(mappings) + ';',
      entry: true,
      deps: { 'split-require': runtimeRow.id },
      indexDeps: { 'split-require': runtimeRow.index }
    }
  }

  // Create a proxy module that will call the dynamic bundle receiver function
  // with the dynamic entry point's exports.
  function makeDynamicEntryRow (entry) {
    var runtimeRow = rows.find(function (row) {
      return row.file === runtimePath
    })

    return {
      id: 'entry' + entry.index,
      source: 'require("split-require").l(' + JSON.stringify(entry.index) + ', require("a"));',
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

function isRequire (node, filename) {
  return node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments.length > 0 &&
    node.arguments[0].type === 'Literal' &&
    node.arguments[0].value === filename
}
