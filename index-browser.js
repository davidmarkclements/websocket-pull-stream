var pull = require('pull-core')
var cmd = require('./cmds.json')
var PULL = 'PULL';
cmd.PULL = cmd.READ;
module.exports = webSocketPullStream
module.exports.source = webSocketPullStream
module.exports.__proto__ = pull

function webSocketPullStream (socket, mode) {
  var src, pullMode, View = DataView;
  
  socket.binaryType = 'arraybuffer';

  if (mode instanceof Object) {
    socket.binaryType = mode.binaryType || socket.binaryType;
    View = mode.binaryView || View;
    mode = mode.mode;
  }

  function sendCmd(c) { 
    (socket.readyState !== 1) ? 
      socket.onopen = function () { sendCmd(c || cmd[mode]) } :
      socket.send(c || cmd[mode]); 
  }

  function pause() { sendCmd(cmd.PAUSE); }
  function resume() { sendCmd(cmd.RESUME); }

  function wrap(data) {
    return typeof data === 'string' || socket.binaryType === 'blob' ? 
      data : 
      new View(data);
  }
  
  if (!cmd[mode = (mode || PULL).toUpperCase()]) { 
    throw Error('Mode ' + mode + ' not supported');
  }
  pullMode = mode === PULL;
	src = pull.Source(function () {
    sendCmd();
    function stream(end, cb) {
      socket.onmessage = pullMode ? 
        function (evt) {
          cb(end, wrap(evt.data)); 
          sendCmd();
        } : 
        function (evt) { 
          cb(end, wrap(evt.data)); 
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