var splitRequire = require('split-require')

var nums = []
var pending = 2

splitRequire('./a', onloaded)
splitRequire('./b', onloaded)

function onloaded (err, exports) {
  nums.push(exports)

  pending--
  if (pending === 0) {
    onready()
  }
}

function onready () {
  nums.push(require('./c'))
  console.log(nums.reduce(add))
}

function add (a, b) { return a + b }
