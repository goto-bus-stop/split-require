var splitRequire = require('split-require')

splitRequire('./text', function (err, exports) {
  require('./log')(exports)
})
