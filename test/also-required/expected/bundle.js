require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"split_require_mappings":[function(require,module,exports){
require("split-require").r({})
},{"split-require":1}],2:[function(require,module,exports){
var dep = require('./dep')
var splitRequire = require('split-require')

// import a module that should already be included in the main bundle via ./dep
splitRequire.t(function(){return require(4)}, function () {
  console.log('loaded whatever')
})

},{"./dep":3,"4":4,"split-require":1}],3:[function(require,module,exports){
var whatever = require('./whatever')

module.exports = function () {
  whatever()
  return 'we already have whatever'
}

},{"./whatever":4}],4:[function(require,module,exports){
module.exports = function whatever () {
  return 'beep boop'
}

},{}],1:[function(require,module,exports){
// Map dynamic bundle entry point IDs to URLs.
var bundles = {}
// Store dynamic bundle exports.
var cache = {}
// Store dynamic bundle loading callbacks, in case the same module is imported
// multiple times simultaneously.
var receivers = {}

function load (index, cb) {
  // Prevent name collisions with JS properties, eg `cache.hasOwnProperty`
  index = '~' + index

  // We already have this bundle.
  if (cache[index]) {
    if (cb) setTimeout(cb.bind(null, null, cache[index]), 0)
    return
  }

  var url = bundles[index]
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
  index = '~' + index
  if (receivers[index]) {
    receivers[index](null, result)
  } else {
    cache[index] = result
  }
}

// Register dynamic bundle URLs.
function registerBundles (obj) {
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      bundles['~' + i] = obj[i]
    }
  }
}

// "Load" a module that we know is included in this bundle.
function loadLocal (requirer, onload) {
  try {
    onload(null, requirer())
  } catch (err) {
    onload(err)
  }
}

// Used by the bundle.
load.r = registerBundles
load.l = loadedBundle
load.t = loadLocal

module.exports = load

},{}]},{},[2]);
