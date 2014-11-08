var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081, origin: '*'})
var wsps = require('../../../index.js')

wss.on('connection', function(ws) {
  var sink = wsps(ws);

  var source = wsps.Source(function () {
    return function src(end, cb) {
      if (end) { return cb(end); }
      setTimeout(function () { 
        cb(null, {rand: Math.random()});  
      }, 500)
      
    }
  })

  source().pipe(sink(Object));
});