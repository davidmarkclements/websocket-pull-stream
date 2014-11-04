var wsps = require('../../index.js')
var WebSocket = require('ws')
var ws = new WebSocket('ws://localhost:8081')
var duplex = wsps(ws)();

var sink = duplex.Funnel(function (data) {
	console.log( data);
})()

var then = Date.now();

var source = wsps.Source(function () {
  return function src(end, cb) {
    if (end) { return cb(end); }
    setTimeout(function () {
      var now = Date.now()
      var diff = now - then;
      cb(null, 'from client ' + Math.random() + ' '  + diff);
      then = now;
    }, 1000)
    
  }
})()

source.pipe(duplex)
duplex.pipe(sink)


