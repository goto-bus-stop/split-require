var splitRequire = require('split-require')

module.exports = function (cb) {
  splitRequire('./d', function (err, exports) {
    if (err) cb(err)
    else cb(null, 'hello from c: ' + exports)
  })
}
