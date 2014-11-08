var wsps = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws)();

var sinkA = wsps.Funnel(function (data) {
	console.log('stream A', data);
})

var sinkB = wsps.Funnel(function (data) {
  console.log('stream B', data);
})

var sinkC = wsps.Funnel(function (data) {
  console.log('stream C', data);
})

src.demux.channel(0).pipe(sinkA());
src.demux.channel(1).pipe(sinkB());
src.demux.channel(2).pipe(sinkC());

