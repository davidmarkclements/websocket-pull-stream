var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../../index.js')

wss.on('connection', function(ws) {
	var src = wsps(ws);

  var sink = wsps.Funnel(function (data) {
    console.log(data);
  })

  src(Object).pipe(sink());

});