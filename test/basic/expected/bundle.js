require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var _$import = require("browserify-dynamic-import/helper");
var xyz = require('./xyz')

_$import(2).then(function (exports) {
  console.log(xyz(10) + exports)
})

},{"./xyz":4,"browserify-dynamic-import/helper":"browserify-dynamic-import/helper"}],4:[function(require,module,exports){
module.exports = function xyz (num) {
  return num + 33
}

},{}],"browserify-dynamic-import/helper":[function(require,module,exports){
/* eslint-disable no-undef, no-return-assign */
var mappings = {"2":"chunk.2.js"}
var cache = Object.create(null)

module.exports = function load (index) {
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

},{}]},{},[1]);
