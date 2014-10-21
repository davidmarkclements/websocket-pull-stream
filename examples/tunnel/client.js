var wsps = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws);

var sink = src.Funnel(function (data) {
	console.log('final', data);
})

var throughA = src.Tunnel(function (data) {
	console.debug('initial', data)
	return data * 100;
})

var throughB = src.Tunnel(function (data) {
	console.info('intermediate', data)
})

var throughC = src.Tunnel(function (data, cb) {
	cb(data / 2)
})

src()
  .pipe(throughA())
  .pipe(throughB())
  .pipe(throughC())
  .pipe(sink());

