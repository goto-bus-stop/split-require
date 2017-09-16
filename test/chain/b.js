import('./d').then(function (exports) {
  console.log('d', exports)
})
module.exports = 'hello from b'
