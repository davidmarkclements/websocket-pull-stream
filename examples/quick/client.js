var wsps = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws);
var sink = wsps.Funnel(console.log.bind(console))

src().pipe(sink());