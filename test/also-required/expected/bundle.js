require=(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({"split_require_mappings":[function(require,module,exports){
require("split-require").b = {};
},{"split-require":1}],2:[function(require,module,exports){
var dep = require('./dep')
var splitRequire = require('split-require')

// import a module that should already be included in the main bundle via ./dep
splitRequire.t(function(){return require(4)}, function () {
  console.log('loaded whatever')
})

},{"./dep":3,"4":4,"split-require":1}],1:[function(require,module,exports){
// Store dynamic bundle exports.
var cache = {}
// Store dynamic bundle loading callbacks.
var receivers = {}

function attachCb (promise, cb) {
  if (cb) {
    promise.then(
      function (result) { cb(null, result) },
      function (err) { cb(err) }
    )
  }
  return promise
}

function load (index, cb) {
  if (cache[index]) {
    return attachCb(cache[index], cb)
  }
  var url = load.b[index]
  if (!url) {
    return attachCb(
      Promise.reject(new Error('Dynamic bundle "' + index + '" not found')),
      cb
    )
  }

  var integrity = load.s[index]
  var crossOrigin = load.c

  return attachCb(new Promise(function (resolve, reject) {
    var s = document.createElement('script')
    s.async = true
    if (crossOrigin) s.crossOrigin = crossOrigin
    if (integrity) s.integrity = integrity

    receivers[index] = resolve

    s.type = 'application/javascript'
    s.src = url
    s.onerror = function () {
      reject(Error('Failed to load'))
    }
    document.body.appendChild(s)
  }), cb)
}

// Called by dynamic bundles once they have loaded.
function loadedBundle (index, result) {
  if (receivers[index]) {
    receivers[index](result)
  } else {
    // This bundle was loaded without `splitRequire` being called—possibly
    // using a <script async defer> tag or something.
    // Insert it into the cache.
    cache[index] = Promise.resolve(result)
  }
}

// "Load" a module that we know is included in this bundle.
function loadLocal (requirer, onload) {
  return attachCb(Promise.resolve().then(requirer), onload)
}

// These properties are configured by the split-require browserify plugin:
// Map dynamic bundle entry point IDs to URLs.
load.b = {}
// Subresource integrity hashes
load.s = {}
// Cross-origin loading
load.c = null

// These functions are used by the split-require browserify plugin:
load.l = loadedBundle
load.t = loadLocal

module.exports = load

},{}],3:[function(require,module,exports){
var whatever = require('./whatever')

module.exports = function () {
  whatever()
  return 'we already have whatever'
}

},{"./whatever":4}],4:[function(require,module,exports){
module.exports = function whatever () {
  return 'beep boop'
}

},{}]},{},["split_require_mappings",2]);
