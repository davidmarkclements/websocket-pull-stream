var pull = require('pull-stream')
var stps = require('stream-to-pull-stream')
var cmd = require('./cmds.json')
var cmds = Object.keys(cmd).map(function(c) {return cmd[c]; })

module.exports = webSocketPullStream
module.exports.__proto__ = pull;
function noop(){}
function webSocketPullStream (socket, binary) {
  binary = binary === 'binary'

  function queue(msg) {
    queue.list.push(msg);
  }
  queue.list = [];
  socket.on('message', queue)
  state.was = {};
  state.paused = null;

  function processCmd(read) {
    return function (message) {
        if (!message.indexOf(cmds)) {return;}
        if (state(message).paused) {return;}
        read(null, function next(end, data) {
          data = binary ?
            !(data instanceof Buffer) ?
              Buffer(data+'') :
              data :
            data + '';

          if (end || !data) {return;}
          if (message === cmd.END) {
            read(cmd.END)
            return;
          }
          if (message === cmd.RESUME && state.was.flowing) {
            state.was.flowing = null;
            message = cmd.FLOW;
          } 
          data = Buffer('abcdefgh')
          socket.send(data)
          if (message === cmd.FLOW) {
            if (state(message).paused) {
              state.was.flowing = true;
              return;
            }
            return setImmediate(read.bind(null, null, next))
          }


        })

      }
  }


	var sink = pull.Sink(function (read) {
    socket.removeListener('message', queue);
    queue.list.forEach(processCmd(read))
		socket.on('message', processCmd(read));
	})

  function funnel() {
    var s = sink();
    
    ;['on', 'once', 'write', 'end', 'removeListener']
      .forEach(function(k) {
        s[k] = noop;
      });

    s.emit = function (type, stream) {
      if (type !== 'pipe') {return;}
      stps.source(stream).pipe(s)
    }
    s.Tunnel = Tunnel;
    return s;
  }
  
  funnel.Tunnel = Tunnel;

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

  return funnel;
}

function state(message) {
  if (message === cmd.PAUSE) {
    state.paused = true;
  }
  if (message === cmd.RESUME) {
    state.paused = false;
  }
  return state
}



