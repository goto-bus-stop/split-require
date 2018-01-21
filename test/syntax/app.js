#!/usr/bin/env node
const object = { ["xyz"]: 0 }
var spread = { ...object }
require(`split-require`)('./xyz', function (err, { run, ...props }) {
  run(spread, props)
})
