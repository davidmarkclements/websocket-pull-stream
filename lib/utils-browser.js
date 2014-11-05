function noop(){}
function wrap(data, View) {
  return typeof data === 'string' ? 
    data : 
    new View(data);
}
function encase(duplex) {
  return function stream() { return duplex; };
}
function facade(socket) {
  socket.binaryType = 'arraybuffer';
  socket.on = socket.on || function (topic, fn) {
    function cb(e) {
      fn(e.data || e)
    }
    fn.cb = cb;
    socket.addEventListener(topic, cb)
  }
  socket.removeListener = socket.removeListener || function (topic, fn) {
    socket.removeEventListener(topic, fn.cb || fn)
  } 
}
function defaults(opts) { 
  opts.View = opts.View || window.Uint8Array || String;
  return opts;
}
module.exports = {
  noop: noop,
  wrap: wrap,
  encase: encase,
  facade: facade,
  defaults: defaults
}