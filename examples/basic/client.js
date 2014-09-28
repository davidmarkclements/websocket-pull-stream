var pull = require('pull-stream')
var wsps = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws);

var sink = pull.Sink(function (read) {
  read(null, function next (end, data) {
    if (end) { return }
    console.log(data);
    read(null, next)
  })
})

src().pipe(sink());



