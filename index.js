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
var multi = plex()
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
  var pullMode = opts.mode === 'flow';
  var View = opts.View;
  var Funnel = makeFunnel(pullMode)
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
    read(null, function next(end, data) {
      if (end) return;
      if (socket.readyState !== 1)
        return read(Error('Socket closed'), next)
      socket.send(data)
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
    socket.send(new View(encCmds.READ))
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
  multi(bridge)
  multi(bridge)

  duplex = multi.channel(1)
  encase(multi.channel(2))

  duplex.objects = json.stringify.pipe(multi.channel(2))
  duplex.data = duplex.objects.data = duplex;

  duplex.pipe = function (stream) {
    stream = readRequester.pipe(stream)
    return coaxial
      .channel(1)
      .pipe(wrapper)
      .pipe(stream)
  }

  duplex.objects.pipe = function (stream) {
    stream = readRequester.pipe(stream)
    return coaxial
      .channel(2)
      .pipe(json.parse)
      .pipe(stream)
  }

  duplex.demux = coaxial;
  duplex.mux = multi


  webSocketPullStream.Funnel = Funnel;

  return encase(duplex);

}

webSocketPullStream.Tunnel = Tunnel;
// webSocketPullStream.Funnel = noop;

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

function makeCommandHandler(View) {
  function cmd(message, read) {
    message = (new View(message))[0];
    if (!~cmds.indexOf(message)) return;
    if (state(message).paused) return;
    if (message === cmd.END) return cmd.END;
    
    if (message === cmd.RESUME && state.was.flowing) {
      state.was.flowing = false;
      message = cmd.FLOW;
    }

    cmd.pull()

    if (message !== cmd.FLOW) return;

    if (state(message).paused) {
      state.was.flowing = true;
      return;
    }
    //tell the data sink to keep on
    //reading instead of waiting
    //for notification
    
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
