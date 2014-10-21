var wsps = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws, 'flow');

var sink = src.Funnel(function (data) {
	console.log(data);
})

src().pipe(sink());

