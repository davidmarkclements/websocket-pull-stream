(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
  "READ": "r",
  "FLOW": "f",
  "PAUSE": "p",
  "RESUME": "r",
  "END": "e"
}
},{}],2:[function(require,module,exports){
var wsps = require('../../../index.js')
var ws = new WebSocket('ws://localhost:8081')
var src = wsps(ws)();

var sink = src.Funnel(function (data) {
	console.log(data);
})

src.pipe(sink());


},{"../../../index.js":3}],3:[function(require,module,exports){
var duplex = require('./lib/duplex')
var pull = require('pull-core')

module.exports = webSocketPullStream
module.exports.__proto__ = require('pull-core');

function webSocketPullStream (socket, opts) {
  return duplex(socket, opts);
}
},{"./lib/duplex":4,"pull-core":6}],4:[function(require,module,exports){
var pull = require('pull-core')
var plex = require('pull-plex')
var utils = require('../lib/utils');
var cmd = require('../cmds.json')
var cmds = Object.keys(cmd).map(function(c) {
  return cmd[c]; 
})
var multi = plex()
var noop = utils.noop;
var wrap = utils.wrap;
var unwrap = utils.unwrap;
var encase = utils.encase;
var facade = utils.facade;
var defaults = utils.defaults;

module.exports = function (socket, opts) {
  facade(socket);

  opts = defaults(opts || {})
  var binary = opts.type === 'binary';
  var pullMode = opts.mode === 'flow';
  var View = opts.View;
  var Funnel = makeFunnel(pullMode)
  var command = makeCommandHandler()
  var source = pull.Source(function () {
    return function src(end, cb) {
      if (src.ran) { return; } 
      src.ran = true;
      function next (msg) { cb(0, msg) }
      socket.on('message', next)
    }
  })()
  var dataBridge = pull.Sink(function (read) {
    read(null, function next(end, data) {
      if (end) return;
      if (socket.readyState !== 1)
        return read(Error('Socket closed'), next)
      socket.send(wrap(data, binary, View))
      command.pull = function () {
        read(0, next)
      }
    })
  })()
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
  })()
  var cmdReciever = Funnel(function (msg) {
      return command(msg)
  })()
  var readRequester = Tunnel(function () {
    socket.send(String.fromCharCode(0) + cmd.READ)
  })()
  var unwrapper = Tunnel(function (data) {
    return unwrap(data, View);
  })()

  var coaxial = multi(source)
  var duplex;

  coaxial.channel(0).pipe(cmdReciever)
  coaxial.demux()

  multi(noop) //conceptual placeholder for command stream
  multi(dataBridge)


  duplex = waitReady.pipe(multi.channel(1));
  duplex.demux = coaxial;
  duplex.mux = multi

  duplex.pipe = function (stream) {
    stream = readRequester.pipe(stream)
    return coaxial
      .channel(1)
      .pipe(unwrapper)
      .pipe(stream)
  }

  duplex.Tunnel = Tunnel;
  duplex.Funnel = Funnel;

  return encase(duplex);

}



function Tunnel (fn) {
  return pull.Through(function (read) {
    return function (end, cb) {
      read(null, function (end, data) {
        var mutation;
        if (fn.length < 2) {
          mutation = fn(data)
          cb(end, typeof mutation !== 'undefined' ? mutation : data)
          return;
        }
        fn(data, function (mutation) {
          cb(end, typeof mutation !== 'undefined' ? mutation : data)
        })
      })
    }
  })
}

function Gunnel(fn) {
  return pull.Source(function () {
    return function (end, cb) {
      var output = fn(cb);
      var end = output === true;
      if (end) { output === undefined;}
      cb(end, output)
    };
  })
}
function makeFunnel(pullMode) {
  return function Funnel(fn) {
    return pull.Sink(function (read) {
      read(null, pullMode ? continuation(function (data, next) {
          read(fn(data) || null, next)
        }) : continuation(function (data) { 
          var end = fn(data);
          if (end) { read(end); }
        }))
    })
  }
}

function continuation(fn) {
  return function next(end, data) {
    if (end) { 
      // sendCmd(cmd.PAUSE);
      socket.close();
      return end;
    }
    fn(data, next);
  }
}

function makeCommandHandler() {
  function cmd(message, read) {
      if (!message.indexOf(cmds)) {return;}
      if (state(message).paused) {return;}
          
      if (message === cmd.END) {
        return cmd.END;
      }
      if (message === cmd.RESUME && state.was.flowing) {
        state.was.flowing = null;
        message = cmd.FLOW;
      }

      cmd.pull()

      if (message === cmd.FLOW) {
        if (state(message).paused) {
          state.was.flowing = true;
          return;
        }
        //tell the data sink to keep on
        //reading instead of waiting
        //for notification
      }

  }

  cmd.pull = noop;

  return cmd;
}

function state(message) {
  if (message === cmd.PAUSE) {
    state.paused = true;
  }
  if (message === cmd.RESUME) {
    state.paused = false;
  }
  return state;
}

},{"../cmds.json":1,"../lib/utils":5,"pull-core":6,"pull-plex":7}],5:[function(require,module,exports){
function noop(){}
function wrap(data, binary) {
    return data;
}
function unwrap(data, View) {
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
  unwrap: unwrap,
  encase: encase,
  facade: facade,
  defaults: defaults
}
},{}],6:[function(require,module,exports){
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
    if('function' != typeof reader)
      throw new Error('must pipe to reader')
    return addPipe(reader(read))
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


},{}],7:[function(require,module,exports){
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

var demux = pull.Through(function (read, stream, channels) {
  function demux(end, cb) {
    if (end) {return;}
    read(0, function (end, data) {
      if (end) {return;}
      var decoded = encdec(data)
      var chan = decoded.chan
      channels[chan] = demux.channel(chan) 
      channels[chan].next(decoded.data)
      cb(end, data)
    })
  }

  demux.channels = channels;
  demux.channel =  function (chan) {
    return channels[chan] || 
      (channels[chan] = recieverChannel())
  }

  return demux;
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
      stream = stream.pipe(demux(stream, demuxxing));
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
    return channels[chan];
  }

  return multi;

}
},{"./lib/encdec":8,"pull-core":10}],8:[function(require,module,exports){
var string = require('./encdec-string')
var varint = require('varint')

module.exports = function(data, chan) {
  var chunk, viSize;
  if (typeof data === 'string') {
    return string.apply(0, arguments);
  }

  data = data.buffer || data;

  if (arguments.length > 1) {
      viSize = varint.encodingLength(chan);
      chunk = new Uint8Array(new ArrayBuffer(data.byteLength + viSize))
      varint.encode(chan, chunk)
      chunk.set(data, viSize)
      return chunk.buffer
  }
    
  return {
    chan: varint.decode(new Uint8Array(data)),
    data: data.slice(varint.decode.bytes)
  }

}
},{"./encdec-string":9,"varint":13}],9:[function(require,module,exports){
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
},{"varint":13}],10:[function(require,module,exports){
module.exports=require(6)
},{}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
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

},{}],13:[function(require,module,exports){
module.exports = {
    encode: require('./encode.js')
  , decode: require('./decode.js')
  , encodingLength: require('./length.js')
}

},{"./decode.js":11,"./encode.js":12,"./length.js":14}],14:[function(require,module,exports){

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

},{}]},{},[2])