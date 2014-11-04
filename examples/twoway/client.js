var wsps = require('../../index.js')
var WebSocket = require('ws')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws)();

var sinka = src.Funnel(function (data) {
	console.log('a', data);
})()


src.pipe(sinka)

// src.mux.channel(1).pipe(sinkb);

// src.demux.channel(0).pipe(sink())



window.ws = ws;
window.socket = src.socket
window.pull = wsps.__proto__

window.duplex = src