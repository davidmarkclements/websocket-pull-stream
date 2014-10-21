var wsps = require('../../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws, 'flow');

var d = ''

var sink = wsps.Sink(function (read) {
  read(null, function next (end, data) {
    if (end) { return }
    d += data;
    if (d.length > 10000) { 
      console.log(d); d = ''
      read.pause()
      setTimeout(function () {
        read.resume()
      }, 2000);
    }
    read(null, next)
  })
})

src().pipe(sink());