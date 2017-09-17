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

## Usage

```bash
browserify ./entry -p [ browserify-dynamic-import --dir /output/directory ]
  > /output/directory/bundle.js
```

### Options

#### `--dir`

Set the folder to output dynamic bundles to.

#### `--prefix`

Prefix for the function names that are used to load dynamic bundles.
Defaults to `__browserifyDynamicImport__`, which is probably safe.

### `--public`

Public path to load chunks from.
Defaults to `./`, so chunk #1 is loaded as `./chunk.1.js`.

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

## License

[MIT](LICENSE.md)
