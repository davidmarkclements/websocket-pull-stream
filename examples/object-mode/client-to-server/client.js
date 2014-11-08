var wsps = require('../../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var sink = wsps(ws);

var source = wsps.Source(function () {
  return function src(end, cb) {
    if (end) { return cb(end); }
    // setTimeout(function () { 
      cb(null, {rand: Math.random()});  
    // }, 500)
    
  }
})

source().pipe(sink(Object));
