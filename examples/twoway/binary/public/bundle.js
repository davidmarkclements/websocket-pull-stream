(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
  "READ": 114,
  "END": 101
}
},{}],2:[function(require,module,exports){
var wsps = require('../../../index.js')
var ws = new WebSocket('ws://localhost:8081')
var duplex = wsps(ws)();

var sink = wsps.Funnel(function (data) {
	console.log(data);
})()

var source = wsps.Source(function () {
  return function src(end, cb) {
    if (end) { return cb(end); }
      cb(null, new Uint8Array(('from client ' + Math.random())
        .split('')
        .map(function (c) { 
          return c.charCodeAt(0) 
        })));
  }
})()

source.pipe(duplex)
duplex.pipe(sink)

},{"../../../index.js":3}],3:[function(require,module,exports){
require('setimmediate-min')();
var pull = require('pull-core')
var plex = require('pull-plex')
var utils = require('./lib/utils');
var cmd = require('./cmds.json')
var cmdKeys = Object.keys(cmd) 
var cmds = cmdKeys.map(function(c) {
  return cmd[c]; 
})
var encCmds = cmdKeys.reduce(function (o, k) {
  o[k] = [0, cmd[k]];
  return o;
}, {})
var noop = utils.noop;
var wrap = utils.wrap;
var encase = utils.encase;
var facade = utils.facade;
var defaults = utils.defaults;

module.exports = webSocketPullStream
module.exports.__proto__ = require('pull-core');

function webSocketPullStream (socket, opts) {
  facade(socket);

  opts = defaults(opts || {})

  var multi = plex()
  var flow = opts.mode === 'flow';
  var View = opts.View;
  var command = makeCommandHandler(View)
  var source = pull.Source(function () {
    return function src(end, cb) {
      if (src.ran) { return; } 
      src.ran = true;
      function next (msg) { cb(0, msg) }
      socket.on('message', next)
    }
  })()
  var bridge = pull.Sink(function (read) {
    function next(end, data) {
      if (end) {
        end = command.pull.indexOf(next.r)
        if (~~end) command.pull.splice(end, 1)
        return
      };
      if (socket.readyState > 1)
        return read(Error('Socket closed'), next)
      
      socket.send(data)

      if (flow) return setImmediate(read, 0, next)
      next.r = function () { read(end, next) }  
    }
    
    read(null, function (end, data) { 
      next(end, data) 
      command.pull.push(next.r)
    })
    
  })
  var waitReady = pull.Through(function (read) {
    return function src(end, cb) {
      if (socket.readyState !== 1)
        return socket.on('open', function () { 
          src(end, cb)
        })
      
      read(null, function (end, data) {
        read(end, cb)
      })
    }
  })
  var cmdReciever = Funnel(function (msg) {
      return command(msg)
  })()
  var readRequester = Tunnel(function () {
    if (!flow) socket.send(new View(encCmds.READ))
  })()
  var wrapper = Tunnel(function (data) {
    return wrap(data, View);
  })()
  var json = {
    stringify: Tunnel(function (data) {
      return data && 
        (data.constructor === Object || Array.isArray(data)) ?
          JSON.stringify(data) :
          data;
    })(),
    parse: Tunnel(function (data, cb) {
      try {
        cb(null, JSON.parse(data))
      } catch (e) {
        cb(e)         
      }
    })()
  }

  var coaxial = multi(source)
  var duplex;

  coaxial.channel(0).pipe(cmdReciever)
  coaxial.demux()

  multi(noop /* command stream */)
  multi(bridge())
  multi(bridge())

  duplex = waitReady()
    .pipe(Tunnel(function (data) {
      return typeof data === 'number' ? data+'' : data;
    })())
    .pipe(multi.channel(1))

  duplex.objects = json
    .stringify
    .pipe(encase(waitReady()
      .pipe(multi.channel(2))
    )())

  duplex.source = coaxial
    .channel(1)
    .pipe(wrapper)
    .pipe(readRequester)

  duplex.objects.source = coaxial
    .channel(2)
    .pipe(json.parse)
    .pipe(readRequester)

  duplex.sink = duplex.data = duplex.objects.data = duplex;

  duplex.objects.sink = duplex.objects;

  duplex.pipe = function (stream) {
    return duplex.source.pipe(stream)
  }

  duplex.objects.pipe = function (stream) {
    return duplex.objects.source.pipe(stream)
  }

  duplex.demux = coaxial;
  duplex.mux = multi;

  multi.offset(3); //set multiplexer offset
                  //thus making channels 0-2 "private"

  //overwrite multiplexer channel methods
  //so that mux/demux channels work seamlessly
  //over the transport
  multi.channel = (function (channel) {
    return function muxChannel(n) {
      if (!multi.channels[n+3]) multi(bridge())
      return channel(n)
    }
  }(multi.channel))

  coaxial.channel = (function (channel) {
    return function demuxChannel(n) {
      var chan = channel(n)
      var stream = chan.pipe(readRequester);
      stream.__proto__ = chan;
      return stream;
    }
  }(coaxial.channel)) 

  return encase(duplex);
}

webSocketPullStream.Tunnel = Tunnel;
webSocketPullStream.Funnel = Funnel;

function Tunnel (fn) {
  return encase(pull.Through(function (read) {
    return function (end, cb) {
      read(null, function (end, data) {
        var mutation;
        if (fn.length < 2) {
          mutation = fn(data)
          cb(end, typeof mutation !== 'undefined' ? mutation : data)
          return;
        }
        fn(data, function (end, mutation) {
          cb(end, typeof mutation !== 'undefined' ? mutation : data)
        })
      })
    }
  })())
}

function Funnel(fn) {
  return pull.Sink(function (read) {
    read(null, function (end, data) {
      if (end || fn(data)) socket.close()      
    })
  })
}

function makeCommandHandler(View) {
  function cmd(message, read) {
    message = (new View(message))[0];
    if (!~cmds.indexOf(message)) return;
    if (message === cmd.END) return cmd.END;
    cmd.pull.forEach(function (fn) {fn()});
  }

  cmd.pull = [];

  return cmd;
}


},{"./cmds.json":1,"./lib/utils":4,"pull-core":5,"pull-plex":6,"setimmediate-min":13}],4:[function(require,module,exports){
function noop(){}
function wrap(data, View) {
  return typeof data === 'string' ? 
    data : 
    new View(data);
}
function encase(duplex) {
  return function stream(mode) { 
    return mode === Object ? duplex.objects : duplex;
  }
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
},{}],5:[function(require,module,exports){
exports.id = 
function (item) {
  return item
}

exports.prop = 
function (map) {  
  if('string' == typeof map) {
    var key = map
    return function (data) { return data[key] }
  }
  return map
}

exports.tester = function (test) {
  if(!test) return exports.id
  if('object' === typeof test
    && 'function' === typeof test.test)
      return test.test.bind(test)
  return exports.prop(test) || exports.id
}

exports.addPipe = addPipe

function addPipe(read) {
  if('function' !== typeof read)
    return read

  read.pipe = read.pipe || function (reader) {
    if('function' != typeof reader && 'function' != typeof reader.sink)
      throw new Error('must pipe to reader')
    var pipe = addPipe(reader.sink ? reader.sink(read) : reader(read))
    return reader.source || pipe;
  }
  
  read.type = 'Source'
  return read
}

var Source =
exports.Source =
function Source (createRead) {
  function s() {
    var args = [].slice.call(arguments)
    return addPipe(createRead.apply(null, args))
  }
  s.type = 'Source'
  return s
}


var Through =
exports.Through = 
function (createRead) {
  return function () {
    var args = [].slice.call(arguments)
    var piped = []
    function reader (read) {
      args.unshift(read)
      read = createRead.apply(null, args)
      while(piped.length)
        read = piped.shift()(read)
      return read
      //pipeing to from this reader should compose...
    }
    reader.pipe = function (read) {
      piped.push(read) 
      if(read.type === 'Source')
        throw new Error('cannot pipe ' + reader.type + ' to Source')
      reader.type = read.type === 'Sink' ? 'Sink' : 'Through'
      return reader
    }
    reader.type = 'Through'
    return reader
  }
}

var Sink =
exports.Sink = 
function Sink(createReader) {
  return function () {
    var args = [].slice.call(arguments)
    if(!createReader)
      throw new Error('must be createReader function')
    function s (read) {
      args.unshift(read)
      return createReader.apply(null, args)
    }
    s.type = 'Sink'
    return s
  }
}


exports.maybeSink = 
exports.maybeDrain = 
function (createSink, cb) {
  if(!cb)
    return Through(function (read) {
      var ended
      return function (close, cb) {
        if(close) return read(close, cb)
        if(ended) return cb(ended)

        createSink(function (err, data) {
          ended = err || true
          if(!err) cb(null, data)
          else     cb(ended)
        }) (read)
      }
    })()

  return Sink(function (read) {
    return createSink(cb) (read)
  })()
}


},{}],6:[function(require,module,exports){
var pull = require('pull-core')
var encdec = require('./lib/encdec')
var devnull = pull.Sink(function(read) {
  read(0, function next(end, d) {
    // console.log('pp', d) 
    if (end) {return}
    read(end, next) 
  })
})

var recieverChannel = pull.Source(function () {
  var aborted, cbs = [];
  function channel (end, cb) {
    if (end) { return; }
    if (~cbs.indexOf(cb)) { return; }
    cbs.push(cb);
  }
  channel.abort = function () { aborted = true; }
  channel.next = function (data) {
    cbs.forEach(function (cb) {
      cb(aborted, data)
    });
  }
  return channel;
})

var mux = pull.Through(function (read, stream, index) {
  var aborted;
  function through(end, cb) {
    if (end) {return;}
    read(0, function (end, data) {
      if (end) {return;}
      cb(aborted || end, encdec(data, index))
    })
  }
  through.abort = function () { aborted = true; }
  return through
})

var demux = pull.Through(function (read, stream, channels, offset) {
  function coax(end, cb) {
    if (end) {return;}
    read(0, function (end, data) {
      if (end) {return;}
      var decoded = encdec(data)
      var chan = decoded.chan
      chan -= offset.by;
      channels[chan] = coax.channel(chan) 
      channels[chan].next(decoded.data)
      cb(end, data)
    })
  }

  coax.channels = channels;
  coax.channel =  function (chan) {
    chan += offset.by;
    return channels[chan] || 
      (channels[chan] = recieverChannel())
  }

  return coax;
})

function remover(channel, channels) {
  return function () {
      var ix = channel.index;
      channel.abort();
      channels.slice(ix).forEach(function (s) {
        s.index -= 1;
      })
      channels.splice(ix, 1);
    }
}

module.exports = function plex() {
  var channels = [], demuxxing = [];

  function multi(stream) {
    var ix, channel;

    if (stream.type === 'Source') {
      stream = stream.pipe(demux(stream, demuxxing, offset));
      stream.demux = function demux() { 
        return (demux.ed = demux.ed || stream.pipe(devnull())); 
      }
      return stream;
    }
    ix = channels.length
    channel = mux(stream, ix).pipe(stream)
    channel.remove = remover(channel, channels)

    channels.push(channel)

    return channel;
  }

  multi.channels = channels;

  multi.channel = function (chan) { 
    return channels[chan + offset.by];
  }

  multi.offset = offset

  offset.by = 0
  function offset(n) {
    offset.by = n;
  }


  return multi;

}
},{"./lib/encdec":7,"pull-core":5}],7:[function(require,module,exports){
var string = require('./encdec-string')
var varint = require('varint')

module.exports = function(data, chan) {
  var chunk, viSize;
  if (typeof data === 'string') {
    return string.apply(0, arguments);
  }

  data = new Uint8Array(data.buffer || data);

  if (arguments.length > 1) {
      viSize = varint.encodingLength(chan);
      chunk = new Uint8Array(new ArrayBuffer(data.byteLength + viSize))
      varint.encode(chan, chunk)
      chunk.set(data, viSize)
      return chunk.buffer
  }
    
  return {
    chan: varint.decode(data),
    data: data.buffer.slice(varint.decode.bytes)
  }

}
},{"./encdec-string":8,"varint":11}],8:[function(require,module,exports){
var varint = require('varint');
var FILL = String.fromCharCode(128);

module.exports = function (data, chan) {
  
  if (arguments.length > 1)
    return varint.encode(chan).map(function (n) {
      return String.fromCharCode(n);
    }).join('') + data;

  var maxVarintLength = 0;
  while (++maxVarintLength && (data[maxVarintLength] === FILL));
  maxVarintLength += 8;

  return {
    chan: varint.decode(data
      .slice(0, maxVarintLength)
      .split('')
      .map(function (s) { return s.charCodeAt(0) })),
    data: data.slice(varint.decode.bytes)
  }
}
},{"varint":11}],9:[function(require,module,exports){
module.exports = read

var MSB = 0x80
  , REST = 0x7F

function read(buf, offset) {
  var res    = 0
    , offset = offset || 0
    , shift  = 0
    , counter = offset
    , b
    , l = buf.length
  
  do {
    if(counter >= l) {
      read.bytesRead = 0
      return undefined
    }
    b = buf[counter++]
    res += shift < 28
      ? (b & REST) << shift
      : (b & REST) * Math.pow(2, shift)
    shift += 7
  } while (b >= MSB)
  
  read.bytes = counter - offset
  
  return res
}

},{}],10:[function(require,module,exports){
module.exports = encode

var MSB = 0x80
  , REST = 0x7F
  , MSBALL = ~REST
  , INT = Math.pow(2, 31)

function encode(num, out, offset) {
  out = out || []
  offset = offset || 0
  var oldOffset = offset

  while(num >= INT) {
    out[offset++] = (num & 0xFF) | MSB
    num /= 128
  }
  while(num & MSBALL) {
    out[offset++] = (num & 0xFF) | MSB
    num >>>= 7
  }
  out[offset] = num | 0
  
  encode.bytes = offset - oldOffset + 1
  
  return out
}

},{}],11:[function(require,module,exports){
module.exports = {
    encode: require('./encode.js')
  , decode: require('./decode.js')
  , encodingLength: require('./length.js')
}

},{"./decode.js":9,"./encode.js":10,"./length.js":12}],12:[function(require,module,exports){

var N1 = Math.pow(2,  7)
var N2 = Math.pow(2, 14)
var N3 = Math.pow(2, 21)
var N4 = Math.pow(2, 28)
var N5 = Math.pow(2, 35)
var N6 = Math.pow(2, 42)
var N7 = Math.pow(2, 49)

module.exports = function (value) {
  return (
    value < N1 ? 1
  : value < N2 ? 2
  : value < N3 ? 3
  : value < N4 ? 4
  : value < N5 ? 5
  : value < N6 ? 6
  : value < N7 ? 7
  :              8
  )
}

},{}],13:[function(require,module,exports){
var global = (function(){return this}());
module.exports = function () {
  global.setImmediate = global.setImmediate || function () {
    var args = [].slice.apply(arguments);
    args.splice(1, 0, 0)
    setTimeout.apply(null, args)
  }
}
},{}]},{},[2])