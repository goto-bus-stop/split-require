var test = require('tape')
var path = require('path')
var fs = require('fs')
var browserify = require('browserify')
var readTree = require('read-file-tree')
var rimraf = require('rimraf')
var mkdirp = require('mkdirp')
var to = require('flush-write-stream')
var concat = require('concat-stream')
var hasObjectSpread = require('has-object-spread')
var splitRequirePlugin = require('../plugin')

function splitRequirePath (b) {
  var resolve = b._bresolve
  b._bresolve = function (id, opts, cb) {
    if (id === 'split-require') {
      id = require.resolve('../')
    }
    return resolve(id, opts, cb)
  }
}

function testFixture (t, name, opts, message, next) {
  var entry = path.join(__dirname, name, 'app.js')
  var expectedDir = path.join(__dirname, name, 'expected')
  var actualDir = path.join(__dirname, name, 'actual')
  var plugin = opts.plugin || function (b, opts) {
    return b.plugin(splitRequirePlugin, opts)
  }

  opts.dir = actualDir
  rimraf.sync(actualDir)
  mkdirp.sync(actualDir)

  browserify(entry)
    // Don't include the runtime, so tests don't immediately break when changing its source.
    .external('split-require')
    .plugin(splitRequirePath)
    .plugin(plugin, opts)
    .bundle()
    .pipe(fs.createWriteStream(path.join(actualDir, 'bundle.js')))
    .on('error', t.fail)
    .on('finish', onbuilt)

  function onbuilt () {
    var expected = readTree.sync(expectedDir, { encoding: 'utf8' })
    var actual = readTree.sync(actualDir, { encoding: 'utf8' })
    t.deepEqual(actual, expected, message)
    next()
  }
}

test('basic', function (t) {
  testFixture(t, 'basic', {}, 'should work, and not duplicate the ./xyz module', t.end)
})

test('chain', function (t) {
  testFixture(t, 'chain', {}, 'should work with dynamic imports in dynamically imported modules', t.end)
})

test('also-required', function (t) {
  testFixture(t, 'also-required', {}, 'splitRequire() should work on modules that are already included in the same bundle for some other reason', t.end)
})

test('flat', function (t) {
  testFixture(t, 'flat', {
    plugin: function (b, opts) {
      b.plugin('browser-pack-flat/plugin')
      b.on('split.pipeline', function (pipeline) {
        pipeline.get('pack').splice(0, 1,
          require('browser-pack-flat')({ raw: true }))
      })
      b.plugin(splitRequirePlugin, opts)
    }
  }, 'works together with browser-pack-flat', t.end)
})

test('public-path', function (t) {
  testFixture(t, 'public-path', {
    public: 'http://localhost:9966/build/'
  }, 'chunks can be loaded from a configurable base url', t.end)
})

test('output stream', function (t) {
  t.timeoutAfter(3000)

  var entry = path.join(__dirname, 'output-stream/app.js')
  var expectedDir = path.join(__dirname, 'output-stream/expected')
  var actualTree = {}
  var opts = {
    output: function (bundleName, entry) {
      t.equal(typeof bundleName, 'string', 'output() gets the public filename in the first parameter')
      t.equal(typeof entry, 'object', 'output() gets the entry row in the second parameter')
      return concat(function (contents) {
        t.equal('bundle.js' in actualTree, false, 'should have written all dynamic bundles before completing the main bundle')
        actualTree[bundleName] = contents.toString('utf8')
      })
    }
  }
  browserify(entry)
    .plugin(splitRequirePath)
    .plugin(splitRequirePlugin, opts)
    .bundle()
    .pipe(concat(function (contents) {
      actualTree['bundle.js'] = contents.toString('utf8')
    }))
    .on('error', t.fail)
    .on('finish', onbuilt)

  function onbuilt () {
    readTree(expectedDir, { encoding: 'utf8' }, function (err, expectedTree) {
      t.ifErr(err)
      t.deepEqual(actualTree, expectedTree, 'should have piped all bundles into output() streams')
      t.end()
    })
  }
})

test('without splitRequire()', function (t) {
  testFixture(t, 'no-imports', {}, 'works when splitRequire() is not used', t.end)
})

test('factor-bundle', function (t) {
  var inputDir = path.join(__dirname, 'factor-bundle')
  var actualDir = path.join(__dirname, 'factor-bundle/actual')
  var expectedDir = path.join(__dirname, 'factor-bundle/expected')

  rimraf.sync(actualDir)
  mkdirp.sync(actualDir)

  var b = browserify({
    entries: [
      path.join(inputDir, 'app.js'),
      path.join(inputDir, 'world.js')
    ]
  })
  b.on('factor.pipeline', function (file, pipeline) {
    pipeline.get('pack').unshift(
      splitRequirePlugin.createStream(b, { dir: actualDir }))
  })
  b.plugin('factor-bundle', {
    outputs: [
      path.join(actualDir, 'entry1.js'),
      path.join(actualDir, 'entry2.js')
    ]
  })
  b.plugin(splitRequirePath)
  b.plugin(splitRequirePlugin, { dir: actualDir })

  b.bundle()
    .pipe(fs.createWriteStream(path.join(actualDir, 'bundle.js')))
    .on('error', t.fail)
    .on('finish', onbuilt)

  function onbuilt () {
    // wait a bit for other bundles to be written
    setTimeout(function () {
      var expected = readTree.sync(expectedDir, { encoding: 'utf8' })
      var actual = readTree.sync(actualDir, { encoding: 'utf8' })

      t.equal(Object.keys(actual).length, 4, 'should output 4 files: common, entry 1, entry 2, dynamic 1')
      t.deepEqual(actual, expected, 'should have same contents as expected')
      t.end()
    }, 100)
  }
})

test('naming bundles by emitting `name` event on a stream', function (t) {
  var crypto = require('crypto')
  var input = path.join(__dirname, 'name/app.js')
  var actualDir = path.join(__dirname, 'name/actual')
  var expectedDir = path.join(__dirname, 'name/expected')

  rimraf.sync(actualDir)
  mkdirp.sync(actualDir)

  var b = browserify(input)
  b.plugin(splitRequirePath)
  b.plugin(splitRequirePlugin, {
    output: function (bundleName) {
      var stream = fs.createWriteStream(path.join(actualDir, bundleName))
      var hash = crypto.createHash('sha1')

      return to(onwrite, onend)
      function onwrite (chunk, enc, cb) {
        hash.update(chunk)
        stream.write(chunk, cb)
      }
      function onend (cb) {
        var self = this
        stream.end(function (err) {
          if (err) return cb(err)
          var name = hash.digest('hex').slice(0, 10) + '.js'
          self.emit('name', name)
          fs.rename(path.join(actualDir, bundleName), path.join(actualDir, name), cb)
        })
      }
    }
  })

  b.bundle()
    .pipe(fs.createWriteStream(path.join(actualDir, 'bundle.js')))
    .on('error', t.fail)
    .on('finish', onbuilt)

  function onbuilt () {
    var expected = readTree.sync(expectedDir, { encoding: 'utf8' })
    var actual = readTree.sync(actualDir, { encoding: 'utf8' })

    t.deepEqual(actual, expected, 'should have same contents as expected')
    t.end()
  }
})

test('--full-paths', function (t) {
  var entry = path.join(__dirname, 'chain', 'app.js')
  var actualDir = path.join(__dirname, 'chain', 'actual-full-paths')

  rimraf.sync(actualDir)
  mkdirp.sync(actualDir)

  browserify(entry, { fullPaths: true })
    .plugin(splitRequirePath)
    .plugin(splitRequirePlugin, { dir: actualDir })
    .bundle()
    .pipe(fs.createWriteStream(path.join(actualDir, 'bundle.js')))
    .on('error', t.fail)
    .on('finish', onbuilt)

  function onbuilt () {
    var actual = readTree.sync(actualDir, { encoding: 'utf8' })
    t.deepEqual(Object.keys(actual).sort(), [
      'bundle.1.js', 'bundle.2.js', 'bundle.3.js', 'bundle.4.js', 'bundle.js'
    ], 'should have generated 5 files')
    rimraf.sync(actualDir)
    t.end()
  }
})

test('syntax', { skip: !hasObjectSpread() }, function (t) {
  var entry = path.join(__dirname, 'syntax', 'app.js')
  var actualDir = path.join(__dirname, 'syntax', 'actual')

  rimraf.sync(actualDir)
  mkdirp.sync(actualDir)

  browserify(entry)
    .plugin(splitRequirePath)
    .plugin(splitRequirePlugin, { dir: actualDir })
    .bundle()
    .pipe(fs.createWriteStream(path.join(actualDir, 'bundle.js')))
    .on('error', t.fail)
    .on('finish', onbuilt)

  function onbuilt () {
    var actual = readTree.sync(actualDir, { encoding: 'utf8' })
    t.deepEqual(Object.keys(actual).sort(), [
      'bundle.3.js', 'bundle.js'
    ], 'should have generated 2 files')
    rimraf.sync(actualDir)
    t.end()
  }
})

test('outpipe', function (t) {
  var entry = path.join(__dirname, 'basic', 'app.js')
  var actualDir = path.join(__dirname, 'basic', 'actual-outpipe')
  var output = `uglifyjs > ${actualDir}/%f`

  rimraf.sync(actualDir)
  mkdirp.sync(actualDir)

  browserify(entry, { fullPaths: true })
    .plugin(splitRequirePath)
    .plugin(splitRequirePlugin, { out: output })
    .bundle()
    .pipe(fs.createWriteStream(path.join(actualDir, 'bundle.js')))
    .on('error', t.fail)
    .on('finish', onbuilt)

  function onbuilt () {
    // wait for a bit because it's not flushed yet
    setTimeout(function () {
      var actual = readTree.sync(actualDir, { encoding: 'utf8' })
      t.deepEqual(Object.keys(actual).sort(), [
        'bundle.1.js', 'bundle.js'
      ], 'should have generated 2 files')
      rimraf.sync(actualDir)
      t.end()
    }, 100)
  }
})
