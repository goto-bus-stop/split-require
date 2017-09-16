require=(function(_$expose,_$require){ _$expose.m = {}; _$expose.r = _$require;
var _$c_4 = 30

/* eslint-disable no-undef, no-return-assign */
var mappings = {"1":"chunk.1.js","3":"chunk.3.js"}
var cache = Object.create(null)

var _$load_browserifyDynamicImportHelper = function load (index) {
  if (cache[index]) return cache[index]
  var url = mappings[index]
  var receiver = "__browserifyDynamicImport__" + index
  return cache[index] = new Promise(function (resolve, reject) {
    window[receiver] = resolve
    var s = document.createElement('script')
    s.async = true
    s.type = 'application/javascript'
    s.src = url
    s.onerror = function () {
      reject(new Error('Failed to load'))
    }
    document.body.appendChild(s)
  })
}

var _$app_2 = {};
/* removed: var _$load_browserifyDynamicImportHelper = require("browserify-dynamic-import/helper"); */;
Promise.all([
  _$load_browserifyDynamicImportHelper(1),
  _$load_browserifyDynamicImportHelper(3),
  _$c_4
]).then(function (nums) {
  console.log(nums.reduce(add))
})

function add (a, b) { return a + b }

_$expose.m[4] = _$c_4;
return _$expose}(function r(e,n){return r.m.hasOwnProperty(e)?r.m[e]:"function"!=typeof require||n?"function"==typeof r.r?r.r(e,1):void 0:require(e,1)}, typeof require==="function"?require:void 0));