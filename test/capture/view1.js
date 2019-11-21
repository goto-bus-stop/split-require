module.exports = async function (data) {
  return `<h1>${await data()}</h1>`
}
