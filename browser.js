var bundles = {}
var cache = {}
var receivers = {}

function load (index, cb) {
  // Prevent name collisions with JS properties, eg `cache.hasOwnProperty`
  index = '~' + index

  // We already have this bundle.
  if (cache[index]) {
    if (cb) setTimeout(cb.bind(null, null, cache[index]), 0)
    return
  }

  var url = bundles[index]
  // TODO throw an error if we don't have the url

  // Combine callbacks if another one was already registered.
  var prev = receivers[index]
  receivers[index] = onload

  function onload (err, result) {
    if (prev) prev(err, result)
    else if (!err) cache[index] = result
    if (cb) cb(err, result)
    delete receivers[index]
  }

  // The <script> element for this bundle was already added.
  if (prev) return

  var s = document.createElement('script')
  s.async = true
  s.type = 'application/javascript'
  s.src = url
  s.onerror = function () {
    onload(Error('Failed to load'))
  }
  document.body.appendChild(s)
}

// Called by dynamic bundles once they have loaded.
function loadedBundle (index, result) {
  index = '~' + index
  if (receivers[index]) {
    receivers[index](null, result)
  } else {
    cache[index] = result
  }
}

// Register dynamic bundle URLs.
function registerBundles (obj) {
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      bundles['~' + i] = obj[i]
    }
  }
}

// Used by the bundle.
load.r = registerBundles
load.l = loadedBundle

module.exports = load
