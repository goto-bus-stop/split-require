require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({"split_require_mappings":[function(require,module,exports){
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
