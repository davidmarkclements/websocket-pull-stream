var wsps = require('../../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws, 'flow');

var d = ''

var sink = wsps.Funnel(function (data) {
  d += data;
  if (d.length > 10000) { 
    console.log(d); d = ''
    src.pause()
    setTimeout(function () {
      src.resume()
    }, 2000);
  }
})

src().pipe(sink());