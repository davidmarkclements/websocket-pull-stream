var pull = require('pull-stream')
var cmd = require('./cmds.json')
cmd.PULL = cmd.READ;
module.exports = webSocketPullStream
module.exports.source = webSocketPullStream
//module.exports.sink = 

function webSocketPullStream (socket, type) {
  function sendCmd(c) { 
    if (socket.readyState !== 1) {
      socket.onopen = function () { sendCmd(c || cmd[type]); }
      return;
    }
    socket.send(c || cmd[type]); 
  }

  type = (type || 'PULL').toUpperCase();
	return pull.Source(function () {
    sendCmd();
    function stream(end, cb) {
      socket.onmessage = type === 'PULL' ? 
        function (evt) {
          cb(end, evt.data); 
          sendCmd();
        } : 
        function (evt) { 
          cb(end, evt.data); 
        }
    }
    stream.pause = function () { sendCmd(cmd.PAUSE); }
    stream.resume = function () { sendCmd(cmd.RESUME); }
    return stream;
  })

}