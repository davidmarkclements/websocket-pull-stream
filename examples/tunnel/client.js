var wsps = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws);

var sink = wsps.Funnel(function (data) {
	console.log('final', data);
})

var throughA = wsps.Tunnel(function (data) {
	console.debug('initial', data)
	return data * 100;
})

var throughB = wsps.Tunnel(function (data) {
	console.info('intermediate', data)
})

var throughC = wsps.Tunnel(function (data, cb) {
	cb(data / 2)
})

src()
  .pipe(throughA())
  .pipe(throughB())
  .pipe(throughC())
  .pipe(sink());

