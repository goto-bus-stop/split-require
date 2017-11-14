var dep = require('./dep')
var splitRequire = require('split-require')

// import a module that should already be included in the main bundle via ./dep
splitRequire('./whatever', function () {
  console.log('loaded whatever')
})
