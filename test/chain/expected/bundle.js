require=(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({"split_require_mappings":[function(require,module,exports){
require("split-require").b = {"1":"bundle.1.js","3":"bundle.3.js","4":"bundle.4.js","5":"bundle.5.js"};
},{"split-require":"split-require"}],2:[function(require,module,exports){
var splitRequire = require('split-require')

splitRequire(1, function (err, exports) {
  console.log('a', exports)
})
splitRequire(3, function (err, exports) {
  console.log('b', exports)
})

},{"split-require":"split-require"}]},{},["split_require_mappings",2]);
