var test = require('tape')
var path = require('path')
var fs = require('fs')
var browserify = require('browserify')
var readTree = require('read-file-tree')
var rimraf = require('rimraf')
var mkdirp = require('mkdirp')
var concat = require('concat-stream')
var dynamicImport = require('../')

function testFixture (t, name, opts, message, next) {
  var entry = path.join(__dirname, name, 'app.js')
  var expectedDir = path.join(__dirname, name, 'expected')
  var actualDir = path.join(__dirname, name, 'actual')
  var plugin = opts.plugin || function () {}

  opts.dir = actualDir
  rimraf.sync(actualDir)
  mkdirp.sync(actualDir)

  browserify(entry)
    .plugin(plugin)
    .plugin(dynamicImport, opts)
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
  testFixture(t, 'chain', {}, 'shoud work with dynamic imports in dynamically imported modules', t.end)
})

test('also-required', function (t) {
  testFixture(t, 'also-required', {}, 'import() should work on modules that are already included in the same bundle for some other reason', t.end)
})

test('flat', function (t) {
  testFixture(t, 'flat', {
    plugin: function (b) {
      b.plugin('browser-pack-flat/plugin')
      b.on('import.pipeline', function (pipeline) {
        pipeline.get('pack').splice(0, 1,
          require('browser-pack-flat')({ raw: true }))
      })
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
    .plugin(dynamicImport, opts)
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

test('without import()', function (t) {
  testFixture(t, 'no-imports', {}, 'works when import() is not used', t.end)
})

test.skip('factor-bundle', function (t) {
  testFixture(t, 'factor-bundle', {
    plugin: function (b) {
      b.plugin('factor-bundle', {
        outputs: [
          path.join(__dirname, 'factor-bundle/actual', 'entry1.js'),
          path.join(__dirname, 'factor-bundle/actual', 'entry2.js')
        ]
      })
    }
  }, 'works together with factor-bundle', t.end)
})
