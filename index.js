'use strict'

var path = require('path')
var callerPath = require('caller-path')
var resolvePath = require('resolve')

function attachCb (promise, cb) {
  if (cb) {
    promise.then(
      function (result) { cb(null, result) },
      function (err) { cb(err) }
    )
  }
  return promise
}

module.exports = function load (filename, cb) {
  if (typeof filename === 'object' && filename._options) {
    return require('./plugin')(filename, cb)
  }

  var basedir = path.dirname(callerPath())
  var resolved = new Promise(function (resolve, reject) {
    resolvePath(filename, { basedir: basedir }, function (err, fullpath) {
      if (err) return reject(err)

      resolve(fullpath)
    })
  })

  return attachCb(resolved.then(require), cb)
}

Object.defineProperty(module.exports, 'createStream', {
  configurable: true,
  enumerable: true,
  get: function () {
    return require('./plugin').createStream
  }
})
