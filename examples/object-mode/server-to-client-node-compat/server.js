var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../../index.js')
var fs = require('fs')
var JSONStream = require('JSONStream')

wss.on('connection', function(ws) {
	var sink = wsps(ws);

  fs.createReadStream('./data.json')
    .pipe(JSONStream.parse())
    .pipe(sink(Object))
});