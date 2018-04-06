var sr = require('../../')

module.exports = async function route1 () {
  return (await sr('./view1'))(await sr('./data1'))
}
