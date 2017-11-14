var xyz = require('./xyz')
var splitRequire = require('split-require')

splitRequire('./dynamic', function (err, exports) {
  console.log(xyz(10) + exports)
})
