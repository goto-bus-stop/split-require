var splitRequire = require('split-require')

splitRequire('./d', function (err, exports) {
  console.log('d', exports)
})
module.exports = 'hello from b'
