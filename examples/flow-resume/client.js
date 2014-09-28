var pull = require('pull-stream')
var wsps = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws, 'flow');

var d = ''

var sink = pull.Sink(function (read) {
  var i = 0;
  read(null, function next (end, data) {
    if (end) { return }
    d += data;
    if (d.length > 10000) { 
      console.log(d); d = ''
      ws.send('pause')
      setTimeout(function () {
        ws.send('resume');
      }, 2000);
    }
  })
})

src().pipe(sink());