var pull = require('pull-stream')
var wsps = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws, 'flow');

var sink = pull.Sink(function (read) {
  read(null, function next (end, data) {
    if (end) { return }
    console.log(data);
    // NB in flow mode we *don't* read(null, next)
  })
})

src().pipe(sink());
