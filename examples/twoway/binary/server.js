var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../../index.js')

wss.on('connection', function(ws) {
  var duplex = wsps(ws)();

  var source = wsps.Source(function () {
    return function src(end, cb) {
      if (end) { return cb(end); }
      cb(null, Buffer(('from server ' + Math.random())
        .split('')
        .map(function (c) { 
          return c.charCodeAt(0) 
        })));
    }
  })()

  var sink = wsps.Funnel(function (data) {
    console.log(data);
  })()

	source.pipe(duplex)
  duplex.pipe(sink)

});