// Store dynamic bundle exports.
var cache = {}
// Store dynamic bundle loading callbacks.
var receivers = {}

function attachCb (promise, cb) {
  if (cb) {
    promise.then(
      function (result) { cb(null, result) },
      function (err) { cb(err) }
    )
  }
  return promise
}

function load (index, cb) {
  if (cache[index]) {
    return attachCb(cache[index], cb)
  }
  var url = load.b[index]
  if (!url) {
    return attachCb(
      Promise.reject(new Error('Dynamic bundle "' + index + '" not found')),
      cb
    )
  }

  var integrity = load.s[index]
  var crossOrigin = load.c

  return attachCb(new Promise(function (resolve, reject) {
    var s = document.createElement('script')
    s.async = true
    if (crossOrigin) s.crossOrigin = crossOrigin
    if (integrity) s.integrity = integrity

    receivers[index] = resolve

    s.type = 'application/javascript'
    s.src = url
    s.onerror = function () {
      reject(Error('Failed to load'))
    }
    document.body.appendChild(s)
  }), cb)
}

// Called by dynamic bundles once they have loaded.
function loadedBundle (index, result) {
  if (receivers[index]) {
    receivers[index](result)
  } else {
    // This bundle was loaded without `splitRequire` being called—possibly
    // using a <script async defer> tag or something.
    // Insert it into the cache.
    cache[index] = Promise.resolve(result)
  }
}

// "Load" a module that we know is included in this bundle.
function loadLocal (requirer, onload) {
  return attachCb(Promise.resolve().then(requirer), onload)
}

// These properties are configured by the split-require browserify plugin:
// Map dynamic bundle entry point IDs to URLs.
load.b = {}
// Subresource integrity hashes
load.s = {}
// Cross-origin loading
load.c = null

// These functions are used by the split-require browserify plugin:
load.l = loadedBundle
load.t = loadLocal

module.exports = load
