var stps = require('stream-to-pull-stream')

function noop(){}
function wrap(data, View) {
  return typeof data === 'string' ? 
    data : 
    new View(data);
}
function encase(duplex) {
  ;['on', 'once', 'write', 'end', 'removeListener']
    .forEach(function(k) { duplex[k] = noop;});

  duplex.emit = function (type, s) {
    if (type !== 'pipe') {return;}
    duplex.restream = stps.source(s).pipe(duplex)
  }

  if (duplex.type === 'Through') {
    duplex.pipe = (function (pipe) { 
      return function (nextStream) {
        return duplex.restream ?
          duplex.restream.pipe(nextStream) :
          pipe(nextStream)
      }
    }(duplex.pipe));
  }

  return function stream(mode) { 
    return mode === Object ? duplex.objects : duplex;
  }
}
function defaults(opts) { 
  opts.View = opts.View || Buffer;
  return opts;
}
module.exports = {
  noop: noop,
  wrap: wrap,
  encase: encase,
  facade: noop,
  defaults: defaults
}