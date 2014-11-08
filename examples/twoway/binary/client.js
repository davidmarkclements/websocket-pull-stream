var wsps = require('../../../index.js')
var ws = new WebSocket('ws://localhost:8081')
var duplex = wsps(ws)();

var sink = wsps.Funnel(function (data) {
	console.log(data);
})()

var source = wsps.Source(function () {
  return function src(end, cb) {
    if (end) { return cb(end); }
      cb(null, new Uint8Array(('from client ' + Math.random())
        .split('')
        .map(function (c) { 
          return c.charCodeAt(0) 
        })));
  }
})()

source.pipe(duplex)
duplex.pipe(sink)
