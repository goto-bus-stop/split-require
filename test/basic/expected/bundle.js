require=(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({"split_require_mappings":[function(require,module,exports){
require("split-require").b = {"2":"bundle.2.js"};
},{"split-require":"split-require"}],1:[function(require,module,exports){
var xyz = require('./xyz')
var splitRequire = require('split-require')

splitRequire(2, function (err, exports) {
  console.log(xyz(10) + exports)
})

},{"./xyz":4,"split-require":"split-require"}],4:[function(require,module,exports){
module.exports = function xyz (num) {
  return num + 33
}

},{}]},{},["split_require_mappings",1]);
