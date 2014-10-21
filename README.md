# WebSocket Pull Stream

Wrap websockets with pull streams, over 3000% times less browser code than `websocket-stream`

# Quick Example

## Browser:

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



# Updates
Changes between v1.0 and v1.1

  * Drasticially reduced the client-side file size 
    * 20kb down to 4.5kb
    * 4kb down to 1.5kb minified and gzipped
  * Simplified API
    * On the client
      * Additional `Funnel` method on a `websocket-pull-stream` wrapped socket
          * Straightforward way to create `pull-stream` Sink 
    * On the server
      * Seamless compatibility with Node-streams
      * Simply `pipe` from a Node stream into a websocket-pull-stream and everything Just Works.
    * On both
      * Addition convenience `Tunnel` that makes through 
        streams extremely trivial to create.
  * No need to require `pull-stream` / `pull-core`
    * `Sink`, `Through`, `Source` can all be accessed through
      the `websocket-pull-stream` exported object 
  * Client side uses `pull-core` instead of `pull-stream`
    * This is why the file size has dropped
    * It means we don't have the utilities included with
      `pull-stream` but if we wish to use things like
      an asynchronous map function in the client, there
      should be a conscious decision to add it independently.
    * These utilities are still available on the server

# File size
Node streams in the browser come at a cost, it's somewhat paradoxical
to expend high resource for a resource management abstraction.

## Summary
`websocket-pull-stream` is 1.2kb when gzipped and minified.

By using `websocket-pull-stream` we can save 196.9kb, or 24kb when gzipped and minified.


## Discourse

Websocket pull stream addresses this by using a light weight
stream, called a `pull-stream`.

Let's see how websocket-pull-stream clocks in, then we'll compare
it to a similar solution using Node core streams 

```sh
$ npm i websocket-pull-stream
$ echo "require('websocket-pull-stream')" | browserify | wc -c
5515

$ echo "require('websocket-pull-stream')" | browserify | uglifyjs | wc -c
4212
$ echo "require('websocket-pull-stream')" | browserify | uglifyjs | gzip | wc -c
1472
```

(if you wish to run this code you'll need `browserify` and `uglifyjs`)


The `websocket-stream` module wraps websockets with Node core streams,
let's compare this to websocket-pull-stream

```sh
$ npm i websocket-stream
$ echo "require('websocket-stream')" | browserify | wc -c
  201081
$ echo "require('websocket-stream')" | browserify | uglifyjs | wc -c
  108459
$ echo "require('websocket-stream')" | browserify | uglifyjs | gzip | wc -c
  25384
```

So `websocket-stream` minifies pretty well, put it's still 25kb
over the wire, and then consuming a minimum of 108kb in the browser.

# Advantages of `websocket-pull-stream`
  * Implicit backpressure in the entire pipeline (from server to client)
  * Lower file size for the browser (see [File Size](#file-size))
  * Flow mode option with explicit backpressure for optimal transport traffic

# Disadvantages of `websocket-pull-stream`
  * Currently only one-way (server->client)
  * Binary data needs to be addressed
  * Learning curve (simpler, yet different API for stream creation)



# API

The following API assumes we've declared a variable called `wsps`

```javascript
var wsps = require('websocket-pull-stream')
```

## Server
```javascript
wsps(ws:WebSocket) => Function: Sink Factory (sink)
```

```javascript
sink() => Object: Sink  (sinkStream)
```

We interact with the sinkStream by piping to it
(there is no `write` method, all we do is `pipe`)

```
pullStream.pipe(sinkStream)
nodeStream.pipe(sinkStream)
```

Notice we can pipe a Node core stream to a 
websocket-pull-stream. This is not the norm,
Node Streams and Pull Streams are not fully
compatible, usually you have to convert a 
Node Stream to a pull stream with the 
`stream-to-pull-stream` module. However, 
`websocket-pull-stream` detects when a 
Node stream is attempting to pipe it to it, 
and makes this conversion internally. 




### Tunnel

```
sink.Tunnel(fn:(data, cb?:(mutation)) => mutation?) => Through Factory
sinkStream.Tunnel(fn:(data, cb?:(mutation)) => mutation?) => Through Factory

```

`Tunnel` provides a quick and easy way to create 
through streams.

See the browser side API for more info on `Tunnel`


### Advanced pull streams
The following are pull stream creation methods, which
we inherit from [pull-stream][]. 
```javascript
wsps.Source(fn:()=>fn:(end, cb)) => Function: Source Factory
wsps.Sink(fn:(read:(end, next))) => Function: Sink Factory
wsps.Through(fn:(read:(end, next))=>fn:(end, cb)) => Function: Through Factory
```

For many cases the simpler `sink.Tunnel`, `src.Tunnel` and `src.Funnel` stream factories are sufficient.

See [pull-stream][] for more information about these 
advanced pull streams. Other `pull-stream` utilities
(such as `map`, `collect`, etc) are also available on the server
side, via `wsps`.


## Browser
```javascript
wsps(ws:WebSocket, mode?='pull':String) => Function: Source Factory (src)
```
`mode` determines whether the websocket stream will be in
traditional pull mode or "flow mode". See Flow Mode for
more details. 


```javascript
src() => Object: Source  (srcStream)
```

Just like Node streams, readable pull streams 
have a pipe method. 

```
srcStream.pipe(pullStream:Through|Sink) => pullStream
```

In fact, this is the *only* way we should interact
with pull streams, via the `pipe` method. There is no
`emit` or `on` methods, so no `'data'` events. 
Nor is there are read method. 
We just `pipe`. That's it. There is power in simplicity.


### Funnel

```javascript
src.Funnel(fn:(data) => end?) => Sink Factory
srcStream.Funnel(fn:(data) => end?) => Sink Factory
```

`Funnel` provides a quick and easy way to create 
sinks (i.e. write streams). 

#### Funnel Example

```javascript
var wsps = require('websocket-pull-stream')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws);

var sink = src.Funnel(function (data) {
  console.log(data);
})

src().pipe(sink());
```

The above could be created with the more advanced
`wsps.Sink` stream factory (as inherited from `pull-stream`)

```javascript
var wsps = require('websocket-pull-stream')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws);

var sink = wsps.Sink(function (read) {
  read(null, function next (end, data) {
    if (end) { return }
    console.log(data);
    read(null, next)
  })
})

src().pipe(sink());
```
Evidently, `Funnel` takes away much of the boiler plate
involved with creating a `Sink` factory. We only need
use `Sink` when `Funnel` doesn't supply the required 
flexibility. 


### Tunnel

```javascript
src.Tunnel(fn:(data, cb?:(mutation)) => mutation?) => Through Factory
srcStream.Tunnel(fn:(data, cb?:(mutation)) => mutation?) => Through Factory
```


#### Tunnel Example

```javascript
var wsps = require('websocket-pull-stream')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws);

var sink = src.Funnel(function (data) {
  console.log('final', data);
})

var throughA = src.Tunnel(function (data) {
  console.debug('initial', data)
  return data * 100;
})

var throughB = src.Tunnel(function (data) {
  console.info('intermediate', data)
})

var throughC = src.Tunnel(function (data, cb) {
  cb(data / 2)
})

src()
  .pipe(throughA())
  .pipe(throughB())
  .pipe(throughC())
  .pipe(sink());
```

### Pause & Resume

```
src.pause() => void
srcStream.pause => void

src.resume() => void
srcStream.resume() => void
```

Whilst available in both `'flow'` and `'pull'` modes, 
the `pause` and `resume` methods are only really
relevant to flow mode. When using pull streams, 
each chunk is explicitly requested, so `websocket-pull-stream`
explicitly sends data accross the socket to the server
requesting the next chunk. Since this is a somewhat
arduous approach, we have the flow mode option which
asks the server to keep sending data after the first
request. However, this puts us back into a position
of manually handling back pressure - that's where 
`pause` and `resume` come in, these methods are conceptually
equivalent to the `pause` and `resume` methods on Node 
core streams. See Flow Mode for more details. 


# Flow mode

The second parameter to `wsps` accepts a string, that describes
the streaming mode. Options are `'pull'` (default) or `'flow'`.

In the default pull mode each chunk is requested of the server 
via the transport, flow mode amortizes this expense by requesting 
only once to trigger iterating server push.

## Manual backpressure

Pull streams deliver implicit backpressure by design (e.g. if
you don't want it don't ask for it).
However flow mode flips the paradigm back to a kind of push, meaning we 
have to handle backpressure manually (as with Node-style streams).

Backpressure can be handled using the `pause` and `resume` 
methods, as with Node streams.

## Initiate flow mode (browser side):

```javascript
var wsps = require('../../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws, 'flow');

var d = ''

var sink = src.Funnel(function (data) {
  d += data;
  if (d.length > 10000) { 
    console.log(d); d = ''
    src.pause()
    setTimeout(function () {
      src.resume()
    }, 2000);
  }
})

src().pipe(sink());
```

Remember `pause` or `resume` methods don't normally exist on pull-streams,
neither does `'flow'` mode. The `'flow'` has been added for optimal 
transport communication, and the backpressure methods are included as a neccessity of push stream constructs.


# Future
The next milestone is to make the abstraction two way by introducing
multiplexing (so that commands can be embedded in the stream without raw data interference).

Multiplexing (channel embedding) should also open up useful ways to stream to multiple UI sinks with one transport.


## In Depth Explanation
When we attempt to combine WebSockets with a 
time-based abstraction of a collection (e.g. streams)
we lack the appropriate control in the browser to 
fully wrap these transports. 

For instance, the websocket-stream module cannot be paused, 
because the WebSocket transport can't be paused. This means
we have no backpressure, and if we have no backpressure
then the browser is vulnerable to overflowing. That is, 
the incoming WebSocket data comes in faster than the browser
can garbage collect, and the browser crashes. Backpressure 
would make it possible to avoid this issue, we could pause, 
allow derefenced data to be garbage collected and then resume.

So why try to fix a mostly irrelevant edge case?

Because there's another problem with using browserified 
Node streams in the browser: Node core streams add a significant
amount of code, so the benefits of resource mananagement
come at a greater cost in the browser than 
they do in Node natively (the browser has less capacity,
and it's more expensive to load resources).

The pull-stream module is a lot lighter than Node streams, 
it's simply boils down to mutual function recursion.

We cannot directly call a function "accross the wire", 
so websocket-pull-stream aliases a WebSocket message to 
a function call (e.g. the server side "read" method of
the source pull stream).

This retains the purity of the pull stream concept.
This approach also has implit backpressure, as soon as 
we stop asking the server stops giving. However,
it does involve sending data constantly to the server 
from the client which could become expensive, particularly
at scale. 

So websocket-pull-stream also introduces the concept of a flow-stream 
(like the "flowing mode" of Node streams v2). The flow approach makes an initial
pull on the source stream and then transport continues to push
to the client. Along with this come the familiar Node streams
API of pause and resume, to enable backpressure management. 


# Credits

With thanks to

* Dominic Tarr - [pull-stream][]
* Max Ogden - [websocket-stream][]
* Raynos


[pull-stream]: https://github.com/dominictarr/pull-stream
[websocket-stream]: https://github.com/maxogden/websocket-stream



