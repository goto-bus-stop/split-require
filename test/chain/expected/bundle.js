require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"split_require_mappings":[function(require,module,exports){
require("split-require").b = {"2":"bundle.2.js","4":"bundle.4.js","5":"bundle.5.js","6":"bundle.6.js"};
},{"split-require":1}],3:[function(require,module,exports){
var splitRequire = require('split-require')

splitRequire(2, function (err, exports) {
  console.log('a', exports)
})
splitRequire(4, function (err, exports) {
  console.log('b', exports)
})

},{"split-require":1}],1:[function(require,module,exports){
// Store dynamic bundle exports.
var cache = {}
// Store dynamic bundle loading callbacks, in case the same module is imported
// multiple times simultaneously.
var receivers = {}

function load (index, cb) {
  // We already have this bundle.
  if (cache[index]) {
    if (cb) setTimeout(cb.bind(null, null, cache[index]), 0)
    return
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
  if (prev) return

  var s = document.createElement('script')
  s.async = true
  s.type = 'application/javascript'
  s.src = url
  s.onerror = function () {
    onload(Error('Failed to load'))
  }
  document.body.appendChild(s)
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
  nextTick(function () {
    // Just execute the module if no callback is provided
    if (!onload) return requirer()
    try {
      onload(null, requirer())
    } catch (err) {
      onload(err)
    }
  })
}

// Map dynamic bundle entry point IDs to URLs.
load.b = {}

// Used by the bundle.
load.l = loadedBundle
load.t = loadLocal

module.exports = load

},{}]},{},["split_require_mappings",3]);
