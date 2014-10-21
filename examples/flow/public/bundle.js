(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
  "READ": "read",
  "FLOW": "flow",
  "PAUSE": "pause",
  "RESUME": "resume",
  "END": "end"
}
},{}],2:[function(require,module,exports){
var wsps = require('../../index.js')
var ws = new WebSocket('ws://localhost:8081')

var src = wsps(ws, 'flow');

var sink = src.Funnel(function (data) {
	console.log(data);
})

src().pipe(sink());


},{"../../index.js":3}],3:[function(require,module,exports){
var pull = require('pull-core')
var cmd = require('./cmds.json')
var PULL = 'PULL';
cmd.PULL = cmd.READ;
module.exports = webSocketPullStream
module.exports.source = webSocketPullStream
module.exports.__proto__ = pull

function webSocketPullStream (socket, mode) {
  var src, pullMode;
  function sendCmd(c) { 
    (socket.readyState !== 1) ? 
      socket.onopen = function () { sendCmd(c || cmd[mode]) } :
      socket.send(c || cmd[mode]); 
  }

  function pause() { sendCmd(cmd.PAUSE); }
  function resume() { sendCmd(cmd.RESUME); }
  
  if (!cmd[mode = (mode || PULL).toUpperCase()]) { 
    throw Error('Mode ' + mode + ' not supported');
  }
  pullMode = mode === PULL;
	src = pull.Source(function () {
    sendCmd();
    function stream(end, cb) {
      socket.onmessage = pullMode ? 
        function (evt) {
          cb(end, evt.data); 
          sendCmd();
        } : 
        function (evt) { 
          cb(end, evt.data); 
        }
    }
    stream.pause = pause;
    stream.resume = resume;
    stream.socket = socket;
    return stream;
  })
  
  source.pause = pause;
  source.resume = resume;
  source.socket = socket;

  source.Funnel = function (fn) {
    return pull.Sink(function (read) {
      read(null, pullMode ? continuation(function (data, next) {
          read(fn(data) || null, next)
        }) : continuation(function (data) { fn(data) }))
    })
  }

  source.Tunnel = function (fn) {
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

  function continuation(fn) {
    return function next(end, data) {
      if (end) { 
        sendCmd(cmd.PAUSE);
        socket.close();
        return end;
      }
      fn(data, next);
    }
  }

 function source () {
    var s = src();
    s.pause = pause;
    s.resume = resume;
    s.socket = socket;
    s.Funnel = source.Funnel;
    s.Tunnel = source.Tunnel;
    return s;
  }

  return source;

}
},{"./cmds.json":1,"pull-core":4}],4:[function(require,module,exports){
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


},{}]},{},[2])