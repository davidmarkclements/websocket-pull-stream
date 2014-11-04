var pull = require('pull-core')
var cmd = require('../cmds.json')
var cmds = Object.keys(cmd).map(function(c) {return cmd[c]; })
var plex = require('pull-plex')

function noop(){}

function state(message) {
  if (message === cmd.PAUSE) {
    state.paused = true;
  }
  if (message === cmd.RESUME) {
    state.paused = false;
  }
  return state;
}

module.exports = function (socket, binary, multi) {
  var duplex, coaxial;
  binary = binary === 'binary'


  function queue(msg) {
    queue.list.push(msg);
  }
  queue.list = [];
  socket.on('message', queue)
  state.was = {};
  state.paused = false;

  function cmd(message, read) {
      if (!message.indexOf(cmds)) {return;}
      if (state(message).paused) {return;}
          
      if (message === cmd.END) {
        read(cmd.END)
        return;
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

  var source = pull.Source(function () {
    var configured;
    return function (end, cb) {
      if (configured) { return; } 
      configured = true;
      socket.removeListener('message', queue);
      function next (msg) { 
        cb(0, msg) 
      }
      queue.list.forEach(next)
      socket.on('message', next)
    }
  })()

  var dataSink = pull.Sink(function (read) {
    read(null, function next(end, data) {
      data = binary ?
        !(data instanceof Buffer) ?
          Buffer(data+'') :
          data :
        data + '';
      if (end || !data) {return;}
      if (socket.readyState !== 1) {
        read(Error('Socket closed'), next)
        return;
      }
      socket.send(data)

      cmd.pull = function () {
        read(0, next)
      }

    })
  })()


  //cmdReceiver is a sink, it drives the source stream
  var cmdReciever = pull.Sink(function (read) {
    read(0, function next(end, message) {
      cmd(message, read)
    })
  })()
  
  var cmdSender = pull.Sink(function (read) {
    read(0, function next(end, cmd) {
      (socket.readyState !== 1) ? 
        socket.on('open', function () { next(null, cmd) }) :
        (socket.send(cmd), read(0, next));
    })
  })()

  var readRequester = pull.Through(function (read) {
    return function (end, cb) {
      read(null, function (end, data) {
        socket.send(String.fromCharCode(0) + 'read')
        cb(end, data)
      })
    }
  })()

  coaxial = multi(source)
  coaxial.channel(0).pipe(cmdReciever)
  coaxial.demux()

  multi(cmdSender)
  multi(dataSink)

  duplex = multi.channel(1);
  duplex.demux = coaxial;
  duplex.mux = multi

  duplex.pipe = function (stream) {
    stream = readRequester.pipe(stream)
    return coaxial.channel(1).pipe(stream)
  }



  return duplex;

}