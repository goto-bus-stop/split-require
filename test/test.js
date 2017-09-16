var test = require('tape')
var path = require('path')
var fs = require('fs')
var browserify = require('browserify')
var readTree = require('read-file-tree')
var mkdirp = require('mkdirp')
var dynamicImport = require('../')

function testFixture (t, name, opts, message, next) {
  var entry = path.join(__dirname, name, 'app.js')
  var expectedDir = path.join(__dirname, name, 'expected')
  var actualDir = path.join(__dirname, name, 'actual')
  var plugin = opts.plugin || function () {}

  opts.dir = actualDir
  mkdirp.sync(actualDir)

  browserify(entry)
    .plugin(plugin)
    .plugin(dynamicImport, opts)
    .bundle()
    .pipe(fs.createWriteStream(path.join(actualDir, 'bundle.js')))
    .on('error', t.fail)
    .on('finish', onbuilt)

  function onbuilt () {
    readTree(expectedDir, { encoding: 'utf8' }, function (err, expected) {
      if (err) t.fail(err)
      readTree(actualDir, { encoding: 'utf8' }, function (err, actual) {
        if (err) t.fail(err)
        t.deepEqual(actual, expected, message)
        next()
      })
    })
  }
}

test('basic', function (t) {
  testFixture(t, 'basic', {}, 'should work, and not duplicate the ./xyz module', t.end)
})
test('chain', function (t) {
  testFixture(t, 'chain', {}, 'shoud work with dynamic imports in dynamically imported modules', t.end)
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
