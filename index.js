var path = require('path')
var callerPath = require('caller-path')
var resolve = require('resolve')

module.exports = function load (filename, cb) {
  if (!cb) cb = function () {}

  var basedir = path.dirname(callerPath())
  resolve(filename, { basedir: basedir }, function (err, fullpath) {
    if (err) return cb(err)

    try {
      cb(null, require(fullpath))
    } catch (err) {
      cb(err)
    }
  })
}
