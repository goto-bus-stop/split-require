'use strict'

var path = require('path')
var callerPath = require('caller-path')
var resolvePath = require('resolve')
var asyncHooks
try {
  asyncHooks = require('async_hooks')
} catch (err) {
  // async_hooks are not supported.
}

function attachCb (promise, cb) {
  if (cb) {
    promise.then(
      function (result) { cb(null, result) },
      function (err) { cb(err) }
    )
  }
  return promise
}

var captureBundles = new Map()

function capture (run, cb) {
  if (!asyncHooks) throw new Error('async_hooks is not available. Upgrade your Node version to 8.1.0 or higher')

  var hooks = asyncHooks.createHook({
    init: function (asyncId, type, triggerAsyncId) {
      // Inherit bundles list from the parent
      if (captureBundles.has(triggerAsyncId)) {
        captureBundles.set(asyncId, captureBundles.get(triggerAsyncId))
      }
    },
    destroy: function (asyncId) {
      captureBundles.delete(asyncId)
    }
  })

  hooks.enable()

  var currentBundles = []
  var asyncId = asyncHooks.executionAsyncId()
  captureBundles.set(asyncId, currentBundles)

  if (!cb) {
    var promise = new Promise(function (resolve, reject) {
      cb = function (err, result, bundles) {
        if (err) reject(err)
        else resolve({ result: result, bundles: bundles })
      }
    })
  }

  var p = run(ondone)
  if (p && p.then) p.then(function (result) { ondone(null, result) }, ondone)

  return promise

  function ondone (err, result) {
    captureBundles.delete(asyncId) // no memory leak
    hooks.disable()
    cb(err, result, currentBundles)
  }
}

module.exports = function load (filename, cb) {
  if (typeof filename === 'object' && filename._options) {
    return require('./plugin')(filename, cb)
  }

  var currentBundles = asyncHooks && captureBundles.get(asyncHooks.executionAsyncId())

  var basedir = path.dirname(callerPath())
  var resolved = new Promise(function (resolve, reject) {
    resolvePath(filename, { basedir: basedir }, function (err, fullpath) {
      if (err) return reject(err)

      // Add the path to the bundle list if it is being captured
      if (currentBundles) currentBundles.push(fullpath)

      resolve(fullpath)
    })
  })

  return attachCb(resolved.then(require), cb)
}

module.exports.capture = capture

Object.defineProperty(module.exports, 'createStream', {
  configurable: true,
  enumerable: true,
  get: function () {
    return require('./plugin').createStream
  }
})
