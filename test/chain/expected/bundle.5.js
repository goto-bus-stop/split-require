(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"entry5":[function(require,module,exports){
require("split-require").l(5, require("a"));
},{"a":5,"split-require":1}],5:[function(require,module,exports){
var splitRequire = require('split-require')

module.exports = function (cb) {
  splitRequire(6, function (err, exports) {
    if (err) cb(err)
    else cb(null, 'hello from c: ' + exports)
  })
}

},{"split-require":1}]},{},["entry5"]);
