const waitFor = (duration) => new Promise((resolve) => {
  setTimeout(resolve, duration)
})

module.exports = {
  waitFor
}