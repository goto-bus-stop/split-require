import('./a').then(function (exports) {
  console.log('a', exports)
})
import('./b').then(function (exports) {
  console.log('b', exports)
})
