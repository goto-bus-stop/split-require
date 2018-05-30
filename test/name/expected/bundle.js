require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({"split_require_mappings":[function(require,module,exports){
require("split-require").b = {"3":"8e07f19b16.js","4":"f8da7c70ca.js"};
},{"split-require":1}],2:[function(require,module,exports){
var splitRequire = require('split-require')

splitRequire(3)
splitRequire(4)

},{"split-require":1}],1:[function(require,module,exports){
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

},{}]},{},["split_require_mappings",2]);
