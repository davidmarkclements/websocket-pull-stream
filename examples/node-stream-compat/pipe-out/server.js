var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../../index.js')
var psts = require('pull-stream-to-stream')

wss.on('connection', function(ws) {
	var src = wsps(ws);
  src().pipe(process.stdout)
});