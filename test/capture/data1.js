var fs = require('fs')
var path = require('path')
var sr = require('../../')

module.exports = function () {
  return new Promise((resolve, reject )=> {
    // callback somewhere
    fs.readFile(path.join(__dirname, 'json.json'), function (err, d) {
      if (err) reject(err)
      else sr('./data3', function (err, d3) {
        if (err) reject(err)
        else resolve(`this is json: ${JSON.stringify(JSON.parse(d))} and this is d3: ${d3}`)
      })
    })
  })
}
