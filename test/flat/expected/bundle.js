require=(function(_$expose,_$require){ _$expose.m = {}; _$expose.r = _$require;
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

var _$load_1 = load

var _$module_split_require_mappings = {};
_$load_1.b = {"2":"bundle.2.js","4":"bundle.4.js"};
var _$c_5 = 30

var _$app_3 = {};
/* removed: var _$load_1 = require('split-require') */;

var nums = []
var pending = 2

_$load_1(2, onloaded)
_$load_1(4, onloaded)

function onloaded (err, exports) {
  nums.push(exports)

  pending--
  if (pending === 0) {
    onready()
  }
}

function onready () {
  nums.push(_$c_5)
  console.log(nums.reduce(add))
}

function add (a, b) { return a + b }

_$expose.m[1] = _$load_1;
_$expose.m[5] = _$c_5;
return _$expose}(function r(e,n){return r.m.hasOwnProperty(e)?r.m[e]:"function"!=typeof require||n?"function"==typeof r.r?r.r(e,1):void 0:require(e,1)}, typeof require==="function"?require:void 0));