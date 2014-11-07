var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../../index.js')
var rs = require('random-stream')

wss.on('connection', function(ws) {
	var sink = wsps(ws);
	rs().pipe(sink())
});