var xyz = require('./xyz')

import('./dynamic').then(function (exports) {
  console.log(xyz(10) + exports)
})
