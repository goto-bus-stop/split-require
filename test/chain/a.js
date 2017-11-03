var splitRequire = require('split-require')

splitRequire('./c', function (err, exports) {
  if (!err) {
    var result = exports()
    console.log('c', result)
  }
})
module.exports = 'hello from a'
