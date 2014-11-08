# WebSocket Pull Stream

Wrap websockets with pull streams, like websocket-stream
but much smaller yet more feature rich. 

# New in Version 2

* Object mode streams accross the transport
* Two way (duplex) communication
* Multiplexer API for multiple streams over one websocket

See changelog.md for more

# Quick Example

## Browser

```javascript
var wsps = require('websocket-pull-stream')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws);
var sink = src.Funnel(console.log.bind(console))

src().pipe(sink());
```

## Server

```
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('websocket-pull-stream')
var fs = require('fs')

wss.on('connection', function(ws) {
  var sink = wsps(ws);
  fs.createReadStream('server.js').pipe(sink())
});
```


# File size
Node streams in the browser come at a cost, it's somewhat paradoxical
to expend high resource for a resource management abstraction.

```sh
$ npm i websocket-pull-stream
$ echo "require('websocket-pull-stream')" | browserify | uglifyjs -m | wc -c
7953

$ echo "require('websocket-pull-stream')" | browserify | uglifyjs -m 
  | gzip | wc -c
2932

$ npm i websocket-stream
$ echo "require('websocket-stream')" | browserify | uglifyjs -m | wc -c
79116

$ echo "require('websocket-stream')" | browserify | uglifyjs -m | gzip | wc -c
21375
```

# API

Version 2 of websocket-pull-stream is isomorphic,  
the server and client API's are the same.

```javascript
var wsps = require('websocket-pull-stream')
```

## wsps(websocket, [options]) => instantiator([Object]) => duplex

* `websocket` WebSocket instance as per browser or [ws](http://npmjs.org/ws) socket
* `options` Object
  * `mode` String default = `pull`
    * Can be `flow` or `pull` 
    * see [Mode](#mode)
  * `View` Function Constructor default = `Buffer` | `Uint8Array`
    * `Buffer` on the server
    * `Uint8Array` View of `ArrayBuffer` object in the browser
    * see [View](#view)
* => `instantiator` Function
  * `Object` Function - `Object` constructor, puts stream
    into object mode, see [Object Mode](#object-mode)
  * => `duplex` pull-stream

Following the `pull-stream` approach, returns a function 
that creates a stream. The stream returned from this function
is a duplex stream (see [Duplex](#duplex)). 

### Mode

The `mode` option is a string that describes
the streaming mode. Options are `'pull'` (default) or `'flow'`.

In the default pull mode each chunk is requested of the server 
via the transport, flow mode amortizes this expense by requesting 
only once to trigger iterating server push.

### View

In the browser, the `View` option determines what view an incoming
ArrayBuffer is to be wrapped in. 

We default to Uint8Array, which is the simplest form for 
housing binary data - it's also the closest form to node Buffers. 

Any Typed Array constructor can be passed in as `View`,
see mdn docs on [TypedArrays][] for a full list of Typed Arrays.

We can also pass in custom constructors to wrap each ArrayBuffer
object, such as Mozilla's experimental [StringView][] snippet.

If we want to get the actual underlying ArrayBuffer object, regardless
of specified `View` we can fetch it by using the `buffer`
property on any view object - e.g. `data.buffer`.

Note: Be careful with `Uint8ClampedArray`, it's not supported
in IE10.


### Duplex
Piping to a wsps duplex will send data accross the wire,
piping from will recieve data into a sink.

```
//get a websocket
var duplex = wsps(websocket)();

//...create source and sink pull-streams...

source.pipe(duplex)
duplex.pipe(sink)
```

In this scenario (whether on server or client), 
the data from source stream will pipe over the 
transport, and incoming data will be piped into the 
sink.

See the [twoway](tree/master/examples/twoway) examples for more.

### Node-stream Congruence

On the server side, we can pipe Node streams directly
into a websocket pull-stream, and pipe from a
websocket pull-stream into a Node stream. 

```
var sink = wsps(websocket)()
fs.createReadStream(__filename).pipe(sink)
```

See [node-stream-compat](tree/master/examples/node-stream-compat) for
full examples.

### Object Mode

We can stream objects accross the transport, using either
the `duplex.objects` property or setting object mode at
instantiation by passing the Object constructor into
the instantiator function. 

Given the following:

```
var sink = wsps(ws);

var source = wsps.Source(function () {
  return function src(end, cb) {
    if (end) { return cb(end); }
    cb(null, {rand: Math.random()});      
  }
})
```

We can pipe objects accros the wire with


```
source().pipe(sink().objects);
```

Or

```
source().pipe(sink(Object));
```

If we instantiate in object mode, but we wish to 
also pipe string or binary data, we can access
the data stream at the `data` property of the
object stream.

```
var sink = wsps(ws)(Object);
stringSource.pipe(sink.data);
```

This is the same as 
```
var sink = wsps(ws)();
stringSource.pipe(sink);
```

See the [object-mode](tree/master/examples/object-mode) examples
for practical demonstration.

### Multiplexing

The reason two way communication and object mode are possible, 
is because `websocket-pull-stream` is using a multiplexer
([pull-plex]()). The multiplexer is exposed so it can 
be leveraged at an application level. This means, we can
send and receive multiple streams accross a single websocket.

The returned duplex stream has `mux` and `demux` properties. 

To add a stream to the multiplexer simply pipe a source stream
into a channel:

```
var duplex = wsps(ws)();
sourceA().pipe(duplex.mux.channel(0))
sourceB().pipe(duplex.mux.channel(1))
```

To decode the streams the other end, simply pipe
from  `demux.channel(n)` to a sink stream.

```
var duplex = wsps(ws)();
duplex.demux.channel(0).pipe(sinkA());
duplex.demux.channel(1).pipe(sinkB());
```

See the [multiplexing](tree/master/examples/multiplexing) example
for practical demonstrations.

## wsps.Funnel(each(data) => end) => instantiator => sink
  
  * `each` Function
    * `data` Object | string | <binary>
    * => `end` Boolean | Object | String
  * => `instantiator` Function
  * => `sink` wsps.Sink

`Funnel` provides a quick and easy way to create sinks.

```
var createLoggerSink = wsps.Funnel(function (data) {
    console.log(data)

    //end the stream if a condition is met
    if (data > 0.9) { return true; }
})

var sink = createLoggerSink()
```

See the [pultil][] module for more info on `Funnel`.

## wsps.Tunnel(each(data, [cb(mutation)]) => [mutation]) => instantiator => through

  * `each` Function
    * `data` Object | string | <binary>
    * `cb`
      `mutation` Object | string | <binary>
    * => `mutation` Object | string | <binary> default = `data`
  * => `instantiator` Function
  * => `sink` wsps.Sink

`Tunnel` provides a quick and easy way to create 
through streams. It can operate in both synchronous 
and asynchronous fashion (we can either return a
value, or pass a value through a callback).
Returning `undefined` (or not returning) will cause
data to be passed through untouched (useful for logger streams etc).

```
var createMultiplierThrough = wsps.Tunnel(function (data) {
  return data * 100;
})

var createDividerThrough = wsps.Tunnel(function (data, cb) {
  cb(data / 2)
})

var syncThrough = createMultiplierThrough();
var asyncThrough = createDividerThrough();

var logThrough = wsps.Tunnel(function (data) {
  console.log(data);
})() //<-- instantiate immediately
```

See the [tunnel](tree/master/examples/tunnel) example for
a practical demonstration.

See the [pultil][] module for more info on `Tunnel`.


## wsps.Source(create => read(end, cb(end, data))) => instantiator => source
  
  * `create` Function
    * => `read` Function 
      * `end` Boolean | Object | String
      * `cb` Function
        * `end` Boolean | Object | String
        * `data` Object | String | <binary>
  * => `instantiator` Function
  * => `source` wsps.Source

```
var createRandomStream = wsps.Source(function () {
  return function src(end, cb) {
    if (end) { return cb(end); }
    cb(null, Math.random());  
  }
})
var source = createRandomStream()
```

See [pull-stream]() docs for more info. 

## wsps.Sink(reader(read(end, cb)))  => instantiator => sink

  * `reader` Function
    * `read` Function 
      * `end` Boolean | Object | String
      * `cb` Function
  * => `instantiator` Function
  * => `sink` wsps.Sink

```
var createLoggerSink = wsps.Sink(function (read) {
  read(null, function next (end, data) {
    if(end) return
    console.log(data)
    read(null, next)
  })
})

var sink = createLoggerSink()
```

The `read` parameter passed to the `reader` function
will be the `read` function returned from a stream
that is piped into the sink. 

To digest a chunk, we call the `read` parameter, 
the second parameter callback is called `next` (by convention),
notice how once the data is processed, the `read` callback
is called again, passing in the `next` callback. This
recursion causes chunks to be continually pulled
from the read stream - until a truthy value is passed into

See [pull-stream]() docs for more info.


## wsps.Through(reader(read) => read(end, cb))  => instantiator => through

  * `reader` Function
    * `read` Function 
      * `end` Boolean | Object | String
      * `cb` Function
    * => `read` Function 
      * `end` Boolean | Object | String
      * `cb` Function
        * `end` Boolean | Object | String
        * `data` Object | String | <binary>
  * => `instantiator` Function
  * => `sink` wsps.Through


The `Through` stream combines both the `Sink` and `Source` APIs,
naturally - because we're simultaneously reading from a stream
being piped into the through stream, and being read from by 
a proceeding sink or another through stream.

```
var createMultiplierStream = wsps.Through(function (read) {
  return function (end, cb) {
    read(end, function (end, data) {
      cb(end, data * 100)
    })
  }
})

var through = createMultiplierStream()
```

Without both a source and a sink at two ends of a pipeline
of throughs, no operations occur. This means you can compose
through streams out of smaller through streams with pipes

```
var composedThrough;
if (conditionA) {
  composedThrough = throughA.pipe(throughB).pipe(throughC)
} else {
  composedThrough = throughB.pipe(throughA).pipe(throughZ)
}
source.pipe(composedThrough).pipe(sink)
```

See [pull-stream]() docs for more info.


# Gratitude

With thanks to

* Dominic Tarr - [pull-stream][]
* Max Ogden - [websocket-stream][]
* Raynos


# TODO

* Easy way to create object streams on the multiplexer

[pull-stream]: https://github.com/dominictarr/pull-stream
[websocket-stream]: https://github.com/maxogden/websocket-stream
[pultil]: https://github.com/davidmarkclements/pultil
[pull-plex]: https://npmjs.org/pull-plex
[TypedArrays]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays
[DataView]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView
[canisuse.com - Typed Arrays]: http://caniuse.com/#search=TypedArray
[StringView]: https://developer.mozilla.org/en-US/Add-ons/Code_snippets/StringView