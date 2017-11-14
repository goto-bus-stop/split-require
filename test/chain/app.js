var splitRequire = require('split-require')

splitRequire('./a', function (err, exports) {
  console.log('a', exports)
})
splitRequire('./b', function (err, exports) {
  console.log('b', exports)
})
