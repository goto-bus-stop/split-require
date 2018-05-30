require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({"split_require_mappings":[function(require,module,exports){
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
