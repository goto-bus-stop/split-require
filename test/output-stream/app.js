import('./abc').then(function () {
  return import('./dynamic.js')
}).then(function () {
  console.log('done')
})
