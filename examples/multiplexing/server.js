var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../index.js')

wss.on('connection', function(ws) {
	var sourceA = wsps.Source(function () {
	  return function src(end, cb) {
	    if (end) { return cb(end); }
		  cb(null, Math.random()+'');  
	  }
	})

  var sourceB = wsps.Source(function () {
    return function src(end, cb) {
      if (end) { return cb(end); }
      cb(null, ~~(Math.random()*100));  
    }
  })

  var sourceC = wsps.Source(function () {
    return function src(end, cb) {
      if (end) { return cb(end); }
      cb(null, String.fromCharCode((~~(Math.random()*100)+500)));  
    }
  })

	var sink = wsps(ws)();

	sourceA().pipe(sink.mux.channel(0))
  sourceB().pipe(sink.mux.channel(1))
  sourceC().pipe(sink.mux.channel(2))
  

});