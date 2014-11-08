var wsps = require('../../../index.js')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws, {View: DataView})();

var sink = src.Funnel(function (data) {
	console.log(data.constructor.name, data);
})

src.pipe(sink());

