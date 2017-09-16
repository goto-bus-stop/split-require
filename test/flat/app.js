Promise.all([
  import('./a'),
  import('./b'),
  require('./c')
]).then(function (nums) {
  console.log(nums.reduce(add))
})

function add (a, b) { return a + b }
