var pull = require('pull-stream');
var cmd = require('./cmds.json')
var cmds = Object.keys(cmd).map(function(c) {return cmd[c]; })

module.exports = webSocketPullStream

function webSocketPullStream (socket) {
  state.was = {};
  state.paused = null;
	return pull.Sink(function (read) {
		socket.on('message', function(message) {
			if (!message.indexOf(cmds)) {return;}
  		if (state(message).paused) {return;}
			read(null, function next(end, data) {
				if (end || !data) {return;}
				if (message === cmd.END) {
					read(cmd.END)
					return;
				}
        if (message === cmd.RESUME && state.was.flowing) {
          state.was.flowing = null;
          message = cmd.FLOW;
        } 
				socket.send(data+'')
				if (message === cmd.FLOW) {
          if (state(message).paused) {
            state.was.flowing = true;
            return;
          }
					return setImmediate(read.bind(null, null, next))
				}


			})

		});
	})
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



