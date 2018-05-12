# split-require

Bundle splitting for CommonJS and ES modules (dynamic `import()`) in browserify

Lazy load the parts of your app that are not immediately used, to make the
initial load faster.

This module works without a compile step on the server, and in the browser with
the browserify plugin.

> NOTE: split-require v3+ works with browserify 16 and newer. If you are using
> an older browserify version and can't upgrade, use split-require v2.

[What?](#what) -
[Install](#install) -
[Usage](#usage) -
[Plugin CLI](#browserify-plugin-cli-usage) -
[Plugin API](#browserify-plugin-api-usage) -
[License: MIT](#license)

[![stability][stability-image]][stability-url]
[![travis][travis-image]][travis-url]
[![standard][standard-image]][standard-url]

[stability-image]: https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square
[stability-url]: https://nodejs.org/api/documentation.html#documentation_stability_index
[travis-image]: https://img.shields.io/travis/goto-bus-stop/split-require.svg?style=flat-square
[travis-url]: https://travis-ci.org/goto-bus-stop/split-require
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://npm.im/standard

## What?

This plugin takes source files with `splitRequire()` calls like:

```js
var html = require('choo/html')
var app = require('choo')()
var splitRequire = require('split-require')

app.route('/', mainView)
app.mount('body')

var component
function mainView () {
  return html`<body>
    ${component ? component.render() : html`
      <h1>Loading</h1>
    `}
  </body>`
}

splitRequire('./SomeComponent', function (err, SomeComponent) {
  component = new SomeComponent()
  app.emitter.emit('render')
})
```

And splits off `splitRequire()`d files into their own bundles, that will be
dynamically loaded at runtime.
In this case, a main bundle would be created including `choo`, `choo/html` and
the above file, and a second bundle would be created for the `SomeComponent.js`
file and its dependencies.

## Install

```
npm install split-require
```

## Usage

Use the `split-require` function for modules that should be split off into a separate bundle.

```js
var splitRequire = require('split-require')

require('./something') // loaded immediately
splitRequire('./other', function () {}) // loaded async
```

This works out of the box in Node.js.
Add the browserify plugin as described below in order to make it work in the browser, too.

### `import()`

You can use `split-require` with ES modules `import()` syntax using the
[Babel plugin](https://github.com/goto-bus-stop/babel-plugin-dynamic-import-split-require).

```bash
browserify app.js \
  -t [ babelify --plugins dynamic-import-split-require ] \
  -p split-require
```
```js
import('./SomeComponent').then(function (SomeComponent) {
  // Works!
  console.log(SomeComponent)
})
```

> ! Note that this transform is not 100% spec compliant.
> `import()` is an ES modules feature, not a CommonJS one.
> In CommonJS with this plugin, the exports object is the value of the
> `module.exports` of the imported module, so it may well be a function or some
> other non-object value. In ES modules, the exports object in `.then()` will
> always be an object, with a `.default` property for default exports and other
> properties for named exports. You'd never get a function back in `.then()` in
> native ES modules.

## Browserify Plugin CLI Usage

```bash
browserify ./entry -p [ split-require --out /output/directory ]
  > /output/directory/bundle.js
```

### Options

#### `--out`

Set the output for dynamic bundles. Use a folder path to place dynamic bundles
in that folder. You can also use [`outpipe`](https://github.com/substack/outpipe)
syntax: in that case use `%f` in place of the bundle name. For example:

```bash
-p [ split-require --out 'uglifyjs > /output/directory/%f' ]
```

The default is `./`, outputting in the current working directory.

### `--public`

Public path to load dynamic bundles from.
Defaults to `./`, so dynamic bundle #1 is loaded as `./bundle.1.js`.

### `--sri`

Hash algorithm to use for subresource integrity. By default, subresource
integrity is not used.

When enabled, the runtime loader will add `crossorigin` and `integrity`
attributes to dynamically loaded bundles.

One of `sha256`, `sha384`, `sha512`.

## Browserify Plugin API Usage

```js
var splitRequire = require('split-require')

browserify('./entry')
  .plugin(splitRequire, {
    dir: '/output/directory'
  })
  .pipe(fs.createWriteStream('/output/directory/bundle.js'))
```

### With factor-bundle

Through the API, split-require can also be used together with
[factor-bundle](https://github.com/browserify/factor-bundle). Listen for the
`factor.pipeline` event, and unshift the result of the `createStream` function
to the `'pack'` label:

```js
b.plugin(splitRequire, { dir: '/output/directory' })
b.plugin(factorBundle, { /* opts */ })

b.on('factor.pipeline', function (file, pipeline) {
  var stream = splitRequire.createStream(b, {
    dir: '/output/directory'
  })
  pipeline.get('pack').unshift(stream)
})
```

Note that you must pass the options to the plugin _and_ the stream.
Other plugins that generate multiple outputs may need a similar treatment.

### Options

#### `dir`

Set the folder to output dynamic bundles to. Defaults to `./`.
This is only necessary if the `output()` option is not used.

#### `filename(entry)`

Function that generates a name for a dynamic bundle.
Receives the entry point row as the only parameter. The default is:

```js
function filename (entry) {
  return 'bundle.' + entry.index + '.js'
}
```

#### `output(bundleName)`

Function that should return a stream. The dynamic bundle will be written to the
stream. `bundleName` is the generated name for the dynamic bundle.
At runtime, the main bundle will attempt to use this name to load the bundle,
so it should be publically accessible under this name.

The `bundleName` can be changed by emitting a `name` event on the returned
stream **before the stream finishes**. This is useful to generate a bundle name
based on a hash of the file contents, for example.

```js
var fs = require('fs')
var crypto = require('crypto')
var to = require('flush-write-stream')
b.plugin(splitRequire, {
  output: function (bundleName) {
    var stream = fs.createWriteStream('/tmp/' + bundleName)
    var hash = crypto.createHash('sha1')
    return to(onwrite, onend)

    function onwrite (chunk, enc, cb) {
      hash.update(chunk)
      stream.write(chunk, cb)
    }
    function onend (cb) {
      stream.end()
      var name = hash.digest('hex').slice(0, 10) + '.js'
      this.emit('name', name)
      fs.rename('/tmp/' + bundleName, './' + name, cb)
    }
  }
})
```

#### `public`

Public path to load dynamic bundles from.
Defaults to `./`, so dynamic bundle #1 is loaded as `./bundle.1.js`.

### `sri`

Hash algorithm to use for subresource integrity. By default, subresource
integrity is not used.

When enabled, the runtime loader will add `crossorigin` and `integrity`
attributes to dynamically loaded bundles.

One of `sha256`, `sha384`, `sha512`.

### Events

#### `b.on('split.pipeline', function (pipeline, entry, basename) {})`

`split-require` emits an event on the browserify instance for each pipeline it
creates.

`pipeline` is a [labeled-stream-splicer](https://github.com/browserify/labeled-stream-splicer) with labels:

 - `'pack'` - [browser-pack](https://github.com/browserify/browser-pack)
 - `'wrap'` - apply final wrapping

`entry` is the browserify row object for the entry point of the dynamic bundle.
`basename` is the name of the dynamic bundle file.

## License

[MIT](LICENSE.md)
