var sr = require('./')

async function main () {
  var val = await sr('./test2')

  console.log(val)
}

sr.capture(function () {
  return main()
}, function (bundles) {
  console.log(bundles)
})
