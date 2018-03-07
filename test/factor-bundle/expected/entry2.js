require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"split_require_mappings":[function(require,module,exports){
require("split-require").b = {"4":"bundle.4.js"};
},{"split-require":1}],5:[function(require,module,exports){
var splitRequire = require('split-require')

splitRequire(4, function (err, exports) {
  require('./log')(exports)
})

},{"./log":3,"split-require":1}],1:[function(require,module,exports){
// Store dynamic bundle exports.
var cache = {}
// Store dynamic bundle loading callbacks, in case the same module is imported
// multiple times simultaneously.
var receivers = {}

// Attach a promise to a callback, that is settled when the callback is called.
function promisify (cb) {
  var res
  var rej
  var p = typeof Promise !== 'undefined' && new Promise(function (resolve, reject) {
    res = resolve
    rej = reject
  })
  pcb.p = p
  return pcb
  function pcb (err, val) {
    if (cb) cb(err, val)
    if (err) rej(err)
    else res(val)
  }
}

function load (index, cb) {
  cb = promisify(cb)
  // We already have this bundle.
  if (cache[index]) {
    setTimeout(cb.bind(null, null, cache[index]), 0)
    return cb.p
  }

  var url = load.b[index]
  // TODO throw an error if we don't have the url

  // Combine callbacks if another one was already registered.
  var prev = receivers[index]
  receivers[index] = onload

  function onload (err, result) {
    if (prev) prev(err, result)
    else if (!err) cache[index] = result
    if (cb) cb(err, result)
    delete receivers[index]
  }

  // The <script> element for this bundle was already added.
  if (prev) return cb.p

  var integrity = load.s[index]
  var crossOrigin = load.c

  var s = document.createElement('script')
  s.async = true
  if (crossOrigin) s.crossOrigin = crossOrigin
  if (integrity) s.integrity = integrity

  s.type = 'application/javascript'
  s.src = url
  s.onerror = function () {
    onload(Error('Failed to load'))
  }
  document.body.appendChild(s)
  return cb.p
}

// Called by dynamic bundles once they have loaded.
function loadedBundle (index, result) {
  if (receivers[index]) {
    receivers[index](null, result)
  } else {
    cache[index] = result
  }
}

// "Load" a module that we know is included in this bundle.
var nextTick = window.setImmediate || window.setTimeout
function loadLocal (requirer, onload) {
  onload = promisify(onload)
  nextTick(function () {
    // Just execute the module if no callback is provided
    if (!onload) return requirer()
    try {
      onload(null, requirer())
    } catch (err) {
      onload(err)
    }
  })
  return onload.p
}

// Map dynamic bundle entry point IDs to URLs.
load.b = {}
// Subresource integrity hashes
load.s = {}
// Cross-origin loading
load.c = null

// Used by the bundle.
load.l = loadedBundle
load.t = loadLocal

module.exports = load

},{}]},{},["split_require_mappings",5]);
