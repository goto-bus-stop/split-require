var route1 = require('./route1')
var route2 = require('./route2')

module.exports = function (route) {
  if (route === 'one') {
    return route1()
  }
  return require('util').promisify(route2)()
}
