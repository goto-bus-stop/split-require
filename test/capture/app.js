var sr = require('../../')
var render = require('./render')

module.exports = async function app (route) {
  var { bundles, result } = await sr.capture(function () {
    return render(route)
  })

  return { result, bundles }
}
