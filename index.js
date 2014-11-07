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

  duplex.pipe = pipeFromThisSource;

  duplex.objects.pipe = pipeFromThisSource;

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

function pipeFromThisSource(stream) {
  return this.source.pipe(stream)
}

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

