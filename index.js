var duplex = require('./lib/duplex')
var stps = require('stream-to-pull-stream')
var pull = require('pull-core')
var plex = require('pull-plex')
var multi = plex()
module.exports = webSocketPullStream
module.exports.__proto__ = require('pull-core');
module.exports.mux = multi

function noop(){}
function webSocketPullStream (socket, binary) {
  var pullMode;
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

  function funnel() {
    var s = duplex(socket, binary, multi);    
    ;['on', 'once', 'write', 'end', 'removeListener']
      .forEach(function(k) {
        s[k] = noop;
      });

    s.emit = function (type, stream) {
      if (type !== 'pipe') {return;}
      stps.source(stream).pipe(s)
    }
    s.Funnel = Funnel;
    s.Tunnel = Tunnel;
    s.socket = socket;
    return s;
  }
  
  funnel.Tunnel = Tunnel;
  funnel.Funnel = Funnel;


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

  function Funnel (fn) {
    return pull.Sink(function (read) {
      read(null, pullMode ? continuation(function (data, next) {
          read(fn(data) || null, next)
        }) : continuation(function (data) { fn(data) }))
    })
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

  return funnel;
}