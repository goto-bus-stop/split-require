var xyz = require('./xyz')
var splitRequire = require('split-require')

module.exports = function (cb) {
  splitRequire('./dynamic', function (err, exports) {
    cb(xyz(10) + exports)
  })
}
