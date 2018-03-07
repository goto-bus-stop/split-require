require=(function(_$expose,_$require){ _$expose.m = {}; _$expose.r = _$require;
var _$module_split_require_mappings = {};
_$require("split-require").b = {"1":"bundle.1.js","3":"bundle.3.js"};
var _$c_4 = 30

var _$app_2 = {};
var splitRequire = _$require("split-require")

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
  nums.push(_$c_4)
  console.log(nums.reduce(add))
}

function add (a, b) { return a + b }

_$expose.m[4] = _$c_4;
return _$expose}(function r(e,n){return r.m.hasOwnProperty(e)?r.m[e]:"function"!=typeof require||n?"function"==typeof r.r?r.r(e,1):void 0:require(e,1)}, typeof require==="function"?require:void 0));