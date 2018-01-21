exports.run = function (a, b) {
  T.deepEqual(a, { xyz: 0 })
  T.deepEqual(b, { c: 1, d: 3 })
}
exports.c = 1; exports.d = 3
