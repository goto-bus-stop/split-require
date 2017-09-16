import('./c').then(function (exports) {
  return exports()
}).then(function (result) {
  console.log('c', result)
})
module.exports = 'hello from a'
