var Enums = require('./enums.js');
var Security = require('./security.js');

var BetState = Enums.BetState;

exports.server = function(socket) {
    socket.on('BET_SUBSCRIBE', function(un, betname) {
	console.log("socket BET_SUBSCRIBE: username=" + un + ", betname=" + betname);
	var username = Security.check_secure_username(un);
	if (!username) {
	    console.warn("Username in cookies does not match (could have been changed manually at client side).");
	    return;
	}
	socket.username = username;
	var bet = BETS.get(betname);
	if (BETS.get(betname)) {
	    if (socket.room) {
	        socket.leave(socket.room);
	    }
	    socket.room = betname;
	    socket.join(betname);
	    socket.emit('BET_UPDATE', bet.jsonUpdateMsgFor(username));
	}
    });

    socket.on('disconnect', function() {
	console.log("Disconnecting and leaving room " + socket.room);
	if (socket.room) {
	    socket.leave(socket.room);
	}
    });
}
