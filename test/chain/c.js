module.exports = function () {
  return import('./d').then(function (exports) {
    return 'hello from c: ' + exports
  })
}
