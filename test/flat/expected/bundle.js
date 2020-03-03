require = (function (require) {
var exposedRequire = function exposedRequire(e,r){return exposedRequire.m.hasOwnProperty(e)?exposedRequire.m[e]:"function"!=typeof require||r?"function"==typeof exposedRequire.r?exposedRequire.r(e,1):void 0:require(e,1)};
exposedRequire.m = {};
exposedRequire.r = require;var createModuleFactory = function createModuleFactory(t){var e;return function(r){return e||t(e={exports:{},parent:r},e.exports),e.exports}};
var _$c_4 = createModuleFactory(function (module, exports) {
module.exports = 30

});
var _$module_split_require_mappings = {};
require("split-require").b = {"1":"bundle.1.js","3":"bundle.3.js"};
var _$app_2 = {};
var splitRequire = require("split-require")

var nums = []
var pending = 2

splitRequire(1, onloaded)
splitRequire(3, onloaded)

function onloaded (err, exports) {
  nums.push(exports)

  pending--
  if (pending === 0) {
    onready()
  }
}

function onready () {
  nums.push(_$c_4({}))
  console.log(nums.reduce(add))
}

function add (a, b) { return a + b }

Object.defineProperty(exposedRequire.m, 4, { get: function() { return _$c_4({}); }});
return exposedRequire;
}(typeof require === 'function' ? require : void 0));
