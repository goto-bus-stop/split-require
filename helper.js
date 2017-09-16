/* eslint-disable no-undef, no-return-assign */
var mappings = MAPPINGS
var cache = Object.create(null)

module.exports = function load (index) {
  if (cache[index]) return cache[index]
  var url = mappings[index]
  var receiver = PREFIX + index
  return cache[index] = new Promise(function (resolve, reject) {
    window[receiver] = resolve
    var s = document.createElement('script')
    s.async = true
    s.type = 'application/javascript'
    s.src = url
    s.onerror = function () {
      reject(new Error('Failed to load'))
    }
    document.body.appendChild(s)
  })
}
