var sr = require('split-require')

var load1 = sr.bind(null, './one')
var load2 = sr.bind(null, './two')

load1(function () {
  load2(function () {})
})
