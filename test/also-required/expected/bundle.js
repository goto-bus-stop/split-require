require=(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({"split_require_mappings":[function(require,module,exports){
require("split-require").b = {};
},{"split-require":"split-require"}],1:[function(require,module,exports){
var dep = require('./dep')
var splitRequire = require('split-require')

// import a module that should already be included in the main bundle via ./dep
splitRequire.t(function(){return require(3)}, function () {
  console.log('loaded whatever')
})

},{"./dep":2,"3":3,"split-require":"split-require"}],2:[function(require,module,exports){
var whatever = require('./whatever')

module.exports = function () {
  whatever()
  return 'we already have whatever'
}

},{"./whatever":3}],3:[function(require,module,exports){
module.exports = function whatever () {
  return 'beep boop'
}

},{}]},{},["split_require_mappings",1]);
