var test = require('tape')
var series = require('run-series')
var splitRequire = require('split-require')

test('loads dynamic bundles', function (t) {
  series([
    function (cb) { splitRequire('./a', cb) },
    function (cb) { splitRequire('./b', cb) },
    function (cb) { splitRequire('./c', cb) },
    function (cb) { splitRequire('./d', cb) }
  ], function (err, results) {
    t.ifError(err)
    t.deepEqual(results, [
      1,
      2,
      4,
      8
    ])
    t.end()
  })
})

test('promises', function (t) {
  async function run () {
    var one = await splitRequire('./dynOne')
    var two = await splitRequire('./dynTwo')
    return one + two
  }

  run().then(function (three) {
    t.equal(three, 3)
    t.end()
  }, t.fail)
})
