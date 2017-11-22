require=(function(_$expose,_$require){ _$expose.m = {}; _$expose.r = _$require;
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
// Subresource integrity hashes
load.s = {}
// Cross-origin loading
load.c = null

// Used by the bundle.
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