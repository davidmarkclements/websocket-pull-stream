var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../../index.js')

wss.on('connection', function(ws) {
	var source = wsps.Source(function () {
	  return function src(end, cb) {
	    if (end) { return cb(end); }
		  cb(null, Math.random());  
	  }
	})

	var sink = wsps(ws);

	source().pipe(sink())

});