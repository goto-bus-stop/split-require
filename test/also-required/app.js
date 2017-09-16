var dep = require('./dep')

// import a module that should already be included in the main bundle via ./dep
import('./whatever').then(function () {
  console.log('loaded whatever')
})
