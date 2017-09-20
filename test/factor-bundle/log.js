module.exports = function () {
  console.log.apply(console, ['logged: '].concat([].slice.call(arguments)))
}
