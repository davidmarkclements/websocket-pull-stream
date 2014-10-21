var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../index.js')

wss.on('connection', function(ws) {
	var source = wsps.Source(function () {
	  return function src(end, cb) {
	    if (end) { return cb(end); }
	    //slow things down so we can see things
	    //coming through the tunnel
	      setTimeout(function () {
	      	cb(null, Math.random());  	
	      }, 2000)
		  
	  }
	})

	var sink = wsps(ws);

	source().pipe(sink())

});