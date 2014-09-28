# WebSocket Pull Stream

Wrap websockets with [pull streams][pull-stream] for lighter streams in the browser

# File size
Node streams in the browser come at a cost, it's somewhat paradoxical
so expend high resource for a resource management abstraction. 

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
  * Explicit backpressure in flow mode
  * Lower file size for the browser (see File Size)

# Disadvantages
  * Currently only one way (server->client)
  * Binary data needs to be addressed


# How
Wraps the browser websocket API with a Source pull stream (a readers stream),
and a server websocket with Sink pull stream (a readable stream). Client-server
communications are used for a kind of minimal RPC, to control the server->client
stream. 

# Future
The next milestone is to make the abstraction two way by introducing
multiplexing (so that commands can be embedded in the stream without raw
data interference).

# Usage

In the browser:

```javascript
var wsps = require('websocket-pull-stream')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws); // pull stream Source (readable stream)
```

On the server: 

```javascript
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('websocket-pull-stream')

wss.on('connection', function(ws) {


	var sink = wsps(ws); // pull stream Sink (reader stream)

})
```



# Example

Client
```javascript
var pull = require('pull-stream')
var wsps = require('websocket-pull-stream')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws);

var sink = pull.Sink(function (read) {
  read(null, function next (end, data) {
    if (end) { return }
    console.log(data);
    read(null, next)
  })
})

src().pipe(sink());

```

Server
```javascript
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('websocket-pull-stream')

wss.on('connection', function(ws) {
	var source = require('pull-stream').Source(function () {
	  return function src(end, cb) {
	    if (end) { return cb(end); }
		  cb(null, Math.random());  
	  }
	})

	var sink = wsps(ws);

	source().pipe(sink())

});

```



It's also possible to shave further weight from the browser implementation
by only using the parts of pull-stream we need, and stripping out the rest
(or making the rest optionally inclusive).


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



