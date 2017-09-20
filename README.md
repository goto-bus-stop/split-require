# browserify-dynamic-import

dynamic `import()` for browserify

Lazy load the parts of your app that are not immediately used, to make the initial load faster.

[![travis][travis-image]][travis-url]
[![standard][standard-image]][standard-url]

[travis-image]: https://img.shields.io/travis/goto-bus-stop/browserify-dynamic-import.svg?style=flat-square
[travis-url]: https://travis-ci.org/goto-bus-stop/browserify-dynamic-import
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://npm.im/standard

## Install

```
npm install goto-bus-stop/browserify-dynamic-import
```

## CLI Usage

```bash
browserify ./entry -p [ browserify-dynamic-import --dir /output/directory ]
  > /output/directory/bundle.js
```

### Options

#### `--dir`

Set the folder to output dynamic bundles to. Defaults to `./`.

#### `--prefix`

Prefix for the function names that are used to load dynamic bundles.
Defaults to `__browserifyDynamicImport__`, which is probably safe.

### `--public`

Public path to load chunks from.
Defaults to `./`, so chunk #1 is loaded as `./chunk.1.js`.

## API Usage

```js
var dynamicImport = require('browserify-dynamic-import')

browserify('./entry')
  .plugin(dynamicImport, {
    dir: '/output/directory'
  })
  .pipe(fs.createWriteStream('/output/directory/bundle.js'))
```

### Options

#### `dir`

Set the folder to output dynamic bundles to. Defaults to `./`.
This is only necessary if the `output()` option is not used.

#### `outname(entry)`

Function that generates a name for a dynamic bundle.
Receives the entry point row as the only parameter. The default is:

```js
function outname (entry) {
  return 'bundle.' + entry.index + '.js'
}
```

#### `output(bundleName)`

Function that should return a stream. The dynamic bundle will be written to the stream.
`bundleName` is the generated name for the dynamic bundle.
At runtime, the main bundle will attempt to use this name to load the bundle, so it should be publically accessible under this name.

#### `prefix`

Prefix for the function names that are used to load dynamic bundles.
Defaults to `__browserifyDynamicImport__`, which is probably safe.

#### `public`

Public path to load chunks from.
Defaults to `./`, so chunk #1 is loaded as `./chunk.1.js`.

### Events

#### `b.on('import.pipeline', function (pipeline) {})`

`browserify-dynamic-import` emits an event on the browserify instance for each [pipeline] it creates.

`pipeline` is a [labeled-stream-splicer](https://github.com/browserify/labeled-stream-splicer) with labels:

 - `'pack'` - [browser-pack](https://github.com/browserify/browser-pack)
 - `'wrap'` - apply final wrapping

## What?

This plugin takes source files with `import()` calls like:

```js
var html = require('choo/html')
var app = require('choo')()

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

import('./SomeComponent').then(function (SomeComponent) {
  component = new SomeComponent()
  app.emitter.emit('render')
})
```

And splits off `import()`ed files into their own bundles, that will be dynamically loaded at runtime.
In this case, a main bundle would be created including `choo`, `choo/html` and the above file, and a second bundle would be created for the `SomeComponent.js` file and its dependencies.

Note that this isn't 100% spec compliant.
`import()` is an ES modules feature, not a CommonJS one.
In CommonJS with this plugin, the exports object is the value of the `module.exports` of the imported module, so it may well be a function or some other non-object value.
In ES modules, the exports object in `.then()` will always be an object, with a `.default` property for default exports and other properties for named exports.
You'd never get a function back in `.then()` in native ES modules.

## License

[MIT](LICENSE.md)
