var splitRequire = require('split-require')

splitRequire('./abc', onabc)

function onabc (err) {
  if (err) return ondone(err)
  splitRequire('./dynamic.js', ondone)
}

function ondone () {
  console.log('done')
}
