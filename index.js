'use strict'

var fs = require('fs')
var path = require('path')
var callerPath = require('caller-path')
var resolvePath = require('resolve')
var hasAsyncHooks = require('has-async-hooks')()
var asyncHooks = hasAsyncHooks ? require('async_hooks') : null

function attachCb (promise, cb) {
  if (cb) {
    promise.then(
      function (result) { cb(null, result) },
      function (err) { cb(err) }
    )
  }
  return promise
}

var bundleMappings

var captureBundles
var captureHooks
var activeCaptures = 0
if (hasAsyncHooks) {
  captureBundles = new Map()

  captureHooks = asyncHooks.createHook({
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
}

function capture (opts, run, cb) {
  if (typeof opts === 'function') {
    cb = run
    run = opts
    opts = {}
  }
  if (!opts) opts = {}

  if (!hasAsyncHooks) throw new Error('async_hooks is not available. Upgrade your Node version to 8.1.0 or higher')
  if (!bundleMappings && opts.filenames !== true) {
    throw new Error('Load a manifest file before using splitRequire.capture(). ' +
      'This is required to inform split-require about the bundle filenames. ' +
      'If you want the filenames for the unbundled entry points instead, do ' +
      '`splitRequire.capture({ filenames: true }, run, cb)`.')
  }

  if (activeCaptures === 0) captureHooks.enable()
  activeCaptures++

  var currentBundles = []

  if (!cb) {
    var promise = new Promise(function (resolve, reject) {
      cb = function (err, result, bundles) {
        if (err) reject(err)
        else resolve({ result: result, bundles: bundles })
      }
    })
  }

  // Make sure we're in a new async execution context
  // This way doing two .capture() calls side by side from the same
  // sync function won't interfere
  //
  //   sr.capture(fn1)
  //   sr.capture(fn2)
  process.nextTick(newContext)

  return promise

  function newContext () {
    var asyncId = asyncHooks.executionAsyncId()
    captureBundles.set(asyncId, {
      list: currentBundles,
      filenames: opts.filenames === true
    })

    var p = run(ondone)
    if (p && p.then) p.then(function (result) { ondone(null, result) }, ondone)

    function ondone (err, result) {
      captureBundles.delete(asyncId) // no memory leak

      activeCaptures--
      if (activeCaptures === 0) {
        captureHooks.disable()
      }

      cb(err, result, currentBundles)
    }
  }
}

function loadManifest (manifest) {
  if (!bundleMappings) bundleMappings = new Map()

  var mappings = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  var basedir = path.dirname(path.resolve(manifest))
  var publicPath = mappings.publicPath
  var bundles = mappings.bundles
  Object.keys(bundles).forEach(function (bundleName) {
    bundles[bundleName].forEach(function (filename) {
      bundleMappings.set(path.join(basedir, filename), path.join(publicPath, bundleName))
    })
  })
}

module.exports = function load (filename, cb) {
  if (typeof filename === 'object' && filename._options) {
    return require('./plugin')(filename, cb)
  }

  var currentBundles = hasAsyncHooks && activeCaptures > 0
    ? captureBundles.get(asyncHooks.executionAsyncId())
    : null

  var basedir = path.dirname(callerPath())
  var resolved = new Promise(function (resolve, reject) {
    resolvePath(filename, { basedir: basedir }, function (err, fullpath) {
      if (err) return reject(err)

      // Add the path to the bundle list if it is being captured
      if (currentBundles) {
        if (currentBundles.filenames) {
          currentBundles.list.push(fullpath)
        } else {
          var bundle = bundleMappings.get(fullpath)
          if (!bundle) return reject(new Error('Could not find \'' + fullpath + '\' in the bundle manifest'))
          currentBundles.list.push(bundle)
        }
      }

      resolve(fullpath)
    })
  })

  return attachCb(resolved.then(require), cb)
}

module.exports.capture = capture
module.exports.loadManifest = loadManifest

Object.defineProperty(module.exports, 'createStream', {
  configurable: true,
  enumerable: true,
  get: function () {
    return require('./plugin').createStream
  }
})
