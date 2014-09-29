# WebSocket Pull Stream

Wrap websockets with [pull streams][pull-stream] for lighter streams in the browser

# File size
Node streams in the browser come at a cost, it's somewhat paradoxical
to expend high resource for a resource management abstraction. 

```sh
$ echo "var stream = require('stream')" | browserify | gzip | wc -c
  25643

$ npm i pull-stream
$ echo "var stream = require('pull-stream')" | browserify | gzip | wc -c
  4889
```

By using pull-streams we save over 20kb.

# Advantages
  * Implicit backpressure in the entire pipeline (from server to client)
  * Lower file size for the browser (see File Size)
  * Flow mode option with explicit backpressure for optimal transport traffic

# Disadvantages
  * Currently only one-way (server->client)
  * Binary data needs to be addressed


# How
Adds an `onmessage` callback to a websocket and wraps a Source pull stream (a readers stream), around it. 
Client->server communications are used for a kind of minimal RPC, to control the server->client stream. An `onmessage` event waits for control messages and responds by sending data to the client websocket, this gets wrapped with a Sink pull stream (a readable stream).


# Usage

## In the browser

```javascript
var wsPull = require('websocket-pull-stream')
var ws = new WebSocket('ws://localhost:8081')
var src = wsPull(ws); // pull stream Source (readable stream)
```

## On the server

```javascript
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsPull = require('websocket-pull-stream')

wss.on('connection', function(ws) {
	var sink = wsPull(ws); // pull stream Sink (reader stream)
})
```

# Future
The next milestone is to make the abstraction two way by introducing
multiplexing (so that commands can be embedded in the stream without raw
data interference).

Multiplexing (channel embedding) should also open up useful ways to stream
to multiple UI sinks with one transport.

It's also possible to shave further weight from the browser implementation
by only using the parts of pull-stream we need, and stripping out the rest
(or making the rest optionally inclusive). Introducing a code analysis
tool that creates a production build of pull-stream that contains only
what's used would be useful.

# Example

## Client
```javascript
var pull = require('pull-stream')
var wsPull = require('websocket-pull-stream')
var ws = new WebSocket('ws://localhost:8081')

var src = wsPull(ws);

var sink = pull.Sink(function (read) {
  read(null, function next (end, data) {
    if (end) { return }
    console.log(data);
    read(null, next)
  })
})

src().pipe(sink());

```

## Server
```javascript
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsPull = require('websocket-pull-stream')

wss.on('connection', function(ws) {
	var source = require('pull-stream').Source(function () {
	  return function src(end, cb) {
	    if (end) { return cb(end); }
		  cb(null, Math.random());  
	  }
	})

	var sink = wsPull(ws);

	source().pipe(sink())

});
```

# Flow mode

The second parameter to `wsPull` accepts a string, that describes
the streaming mode. Options are `'pull'` (default) or `'flow'`.

In the default pull mode each chunk is requested of the server 
via the transport, flow mode amortizes this expense by requesting 
only once to trigger iterating server push.

## Manual back pressure

Pull streams deliver implicit back pressure by design (e.g. if
you don't want it don't ask for it).
However flow mode flips the paradigm back to a kind of push, meaning we 
have to handle backpressure manually (as with Node-style streams).

Backpressure can be handled using the `pause` and `resume` 
methods, as with Node streams.

## Initiate flow mode (browser side):

```javascript
var pull = require('pull-stream')
var wsPull = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var src = wsPull(ws, 'flow');

var d = '';

var sink = pull.Sink(function (read) {
  var i = 0;
  read(null, function next (end, data) {
    if (end) { return }
    d += data;
    if (d.length > 10000) { 
      console.log(d); 
      d = '';
      read.pause();
      setTimeout(function () {
        read.resume();
      }, 2000);
    }
  })
})

src().pipe(sink());
```

Remember `pause` or `resume` methods don't normally exist on pull-streams,
neither does `'flow'` mode. The `'flow'` has been added for optimal 
transport communication, and the backpressure methods are included as a 
neccessity of push stream constructs.


## Let me explain
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
API of pause and resume, to enable back pressure management. 


# Credits

With thanks to

* Dominic Tarr - [pull-stream][]
* Max Ogden - [websocket-stream][]



[pull-stream]: https://github.com/dominictarr/pull-stream
[websocket-stream]: https://github.com/maxogden/websocket-stream



