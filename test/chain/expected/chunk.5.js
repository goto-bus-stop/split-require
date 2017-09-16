(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"entry5":[function(require,module,exports){
__browserifyDynamicImport__5( require("a") )
},{"a":5}],5:[function(require,module,exports){
var _$browserifyDynamicImport = require("../../helper.js");
module.exports = function () {
  return _$browserifyDynamicImport(6).then(function (exports) {
    return 'hello from c: ' + exports
  })
}

},{"../../helper.js":1}],6:[function(require,module,exports){
module.exports = 'this is d'

},{}]},{},["entry5"]);
