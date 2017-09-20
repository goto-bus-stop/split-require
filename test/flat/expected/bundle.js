require=(function(_$expose,_$require){ _$expose.m = {}; _$expose.r = _$require;
/* eslint-disable no-undef, no-return-assign */
var mappings = {"2":"bundle.2.js","4":"bundle.4.js"}
var cache = Object.create(null)

var _$load_1 = function load (index) {
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

var _$c_5 = 30

var _$app_3 = {};
/* removed: var _$load_1 = require("../../helper.js"); */;
Promise.all([
  _$load_1(2),
  _$load_1(4),
  _$c_5
]).then(function (nums) {
  console.log(nums.reduce(add))
})

function add (a, b) { return a + b }

_$expose.m[5] = _$c_5;
return _$expose}(function r(e,n){return r.m.hasOwnProperty(e)?r.m[e]:"function"!=typeof require||n?"function"==typeof r.r?r.r(e,1):void 0:require(e,1)}, typeof require==="function"?require:void 0));