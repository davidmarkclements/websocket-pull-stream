var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../index.js')

wss.on('connection', function(ws) {
	var source = wsps.Source(function () {
	  return function src(end, cb) {
	    if (end) { return cb(end); }
      setTimeout(function () {
        cb(null, Math.random());
      }, 1000)
		  
	  }
	})()

  var sink = wsps.Sink(function (read, name) {
    read(0, function next(end, data) {
      if (end) {return;}
      console.log(name, data);
      read(0, next)
    })
  })

	var duplex = wsps(ws)();

	source.pipe(duplex)


  // duplex.pipe(sink('Channel 1'))

  // duplex.demux.channel(1).pipe(sink('Channel 1'))



});