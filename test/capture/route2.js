var parallel = require('run-parallel')
module.exports = function (cb) {
  process.nextTick(function () {
    Promise.resolve().then(function () {
      parallel([
        function (cb) { require('../../')('./view2', cb) },
        function (cb) { require('../../')('./data3', cb) }
      ], function (err, xyz) {
        cb(null, xyz[0](`Second route. ${xyz[1]}`))
      })
    })
  })
}
