var Enums = require('./enums.js');
var Security = require('./security.js');
var Consts = require('./consts.js');

var BetState = Enums.BetState;
var ExecState = Enums.ExecState;

exports.server = function(socket) {
    socket.on('BET_SUBSCRIBE', function(un, betname) {
	console.log("socket BET_SUBSCRIBE: username=" + un + ", betname=" + betname);
	var username = Security.check_secure_username(un);
	if (!username) {
	    console.warn("Username in cookies does not match (could have been changed manually at client side).");
	    return;
	}
	socket.username = username;

	if (!betname) {
            if (socket.room) {
                socket.leave(socket.room);
            }
            socket.room = Consts.LOBBY_ROOM_NAME;
            console.log("Joining room " + socket.room);
            socket.join(socket.room);
	}
	else {
	    var bet = BETS.get(betname);
	    if (BETS.get(betname)) {
		if (socket.room) {
		    socket.leave(socket.room);
		}
		socket.room = betname;
		console.log("Joining room " + betname);
		socket.join(betname);
		socket.emit('BET_UPDATE_STATIC', bet.jsonStaticUpdateMsg());
		socket.emit('BET_UPDATE_PARTICIPANTS', bet.jsonParticipantUpdateMsg());
		if (bet.state == BetState.ACTIVE) {
		    socket.emit('BET_UPDATE_DEPTH', bet.jsonDepthUpdateMsg());
		    socket.emit('BET_UPDATE_ORDER', bet.jsonOrderUpdateMsg(username));
		}
		if (bet.state == BetState.SETTLED) {
		    socket.emit('BET_UPDATE_SETTLEMENT_TRADE', bet.jsonTradeSettledUpdateMsg(username));
		    socket.emit('BET_UPDATE_SETTLEMENT', bet.jsonSettlementUpdateMsg(username));
		}
		else {
		    socket.emit('BET_UPDATE_TRADE', bet.jsonTradeUpdateMsg(username));
		}
	    }
	}
    });

    socket.on('BET_CANCEL', function(un, betname, uuid) {
	console.log("socket BET_CANCEL username=" + un + ", betname=" + betname + ", uuid=" + uuid);
	var username = Security.check_secure_username(un);
	if (!username) {
	    console.warn("Username in cookies does not match (could have been changed manually at client side).");
	    return;
	}
	if (!socket.username == username) {
	    console.warn("Username on cancel request does not match username on this socket - this should never happen!");
	    return;
	}
	var bet = BETS.get(betname);
	if (bet) {
	    var result = bet.cancel(uuid);
	    result.uuid = uuid;
	    socket.emit('BET_CANCEL_RESPONSE', result);
	    if (result.success) {
		console.log("Broadcasting depth to room " + betname);
		console.log("Current socket room = " + socket.room);
		IO.sockets.in(betname).emit('BET_UPDATE_DEPTH', bet.jsonDepthUpdateMsg());
	    }
	}
    });

    socket.on('BET_NEWORDER', function(un, betname, verb, price, size) {
	console.log("socket BET_NEWORDER username=" + un + 
	    ", betname=" + betname + 
	    ", verb=" + verb + 
	    ", price=" + price +
	    ", size=" + size);
	var username = Security.check_secure_username(un);
	if (!username) {
	    console.warn("Username in cookies does not match (could have been changed manually at client side).");
	    return;
	}
	if (!socket.username == username) {
	    console.warn("Username on new order request does not match username on this socket - this should never happen!");
	    return;
	}
	var bet = BETS.get(betname);
	var isBid;
	if (verb == 'Bid') {
	    isBid = true;
	}
	else {
	    isBid = false;
	}
	if (bet) {
	    var result = bet.submit(username, isBid, parseFloat(price), parseFloat(size));
	    console.log('result:');
	    console.log(result);
	    var response = {};
	    if (result.state == ExecState.ACCEPTED) {
		response.success = true;
		response.err = '';
		socket.emit('BET_NEWORDER_RESPONSE', response);
		IO.sockets.in(betname).emit('BET_UPDATE_DEPTH', bet.jsonDepthUpdateMsg());

		// Even when no trades recorded, wash-trades (self-crossing) could have reduced order remaining size
		var socketsInRoom = IO.sockets.clients(betname);
		for (i in socketsInRoom) {
		    console.log("Emitting order info for " + socketsInRoom[i].username);
		    socketsInRoom[i].emit('BET_UPDATE_ORDER', bet.jsonOrderUpdateMsg(socketsInRoom[i].username));
		}

		// Update trades only when there are trades
		if (result.msg.length > 0) {
		    var socketsInRoom = IO.sockets.clients(betname);
		    for (i in socketsInRoom) {
			console.log("Emitting order info for " + socketsInRoom[i].username);
			socketsInRoom[i].emit('BET_UPDATE_ORDER', bet.jsonOrderUpdateMsg(socketsInRoom[i].username));
			console.log("Emitting trade info for " + socketsInRoom[i].username);
			socketsInRoom[i].emit('BET_UPDATE_TRADE', bet.jsonTradeUpdateMsg(socketsInRoom[i].username));
		    }
		}
	    }
	    else {
		response.success = false;
		response.err = result.msg;
		socket.emit('BET_NEWORDER_RESPONSE', response);
	    }
	}
    });

    socket.on('BET_INVITE', function(un, betname, invite) {
	console.log("socket BET_INVITE username=" + un + 
	    ", betname=" + betname + 
	    ", invite=" + invite);
	var username = Security.check_secure_username(un);
	if (!username) {
	    console.warn("Username in cookies does not match (could have been changed manually at client side).");
	    return;
	}
	if (!socket.username == username) {
	    console.warn("Username on new order request does not match username on this socket - this should never happen!");
	    return;
	}
	if (/,/.test(invite)) {
	    socket.emit('BET_INVITE_RESPONSE', {'success': false, 
		'msg': 'One person at a time please (no comma-deliminated list)'});
	    return;
	}

	var msg = '';
	POSTGRES_CLIENT.query('SELECT * from users;', function(err, result) {
	    if(err) {
		socket.emit('BET_INVITE_RESPONSE', {'success': false, 
		    'msg': 'Database non-responsive'});
		return;
	    }
	    msg = 'Username ' + invite + ' is not registered';
	    for (ind in result.rows) {
		var thisuser = Security.check_secure_username(result.rows[ind].username);
		console.log("checking " + thisuser);
		if (thisuser == invite) {
		    msg = '';
		}
	    }
	    console.log(msg);
	    if (msg.length > 0) {
		socket.emit('BET_INVITE_RESPONSE', {'success': false, 
		    'msg': msg});
		return;
	    }
	    console.log("Still going");

	    var bet = BETS.get(betname);
	    if (bet) {
		var result = bet.addParticipant(invite);
		console.log(result);
		if (result.success) {
		    socket.emit('BET_INVITE_RESPONSE', {'success': true, 'msg': result.msg});
		    var socketsInRoom = IO.sockets.clients(betname);
		    for (i in socketsInRoom) {
			console.log("Updating participants list for " + socketsInRoom[i].username);
			socketsInRoom[i].emit('BET_UPDATE_PARTICIPANTS', bet.jsonParticipantUpdateMsg());
		    }
		    var allSockets = IO.sockets.clients();
		    for (i in allSockets) {
			console.log('allSockets[i].username=' + allSockets[i].username + ', invite=' + invite);
			if (allSockets[i].username == invite) {
			    console.log('They are equal so sending bet list');
			    send_bet_list(allSockets[i]);
			}
		    }
		}
		else {
		    socket.emit('BET_INVITE_RESPONSE', {'success': false, 'msg': result.msg});
		}
	    }
	});
    });

    socket.on('BET_SETTLE', function(un, betname, settlementPrice) {
	console.log("socket BET_SETTLE username=" + un + 
	    ", betname=" + betname + 
	    ", settlementPrice=" + settlementPrice);
	var username = Security.check_secure_username(un);
	if (!username) {
	    console.warn("Username in cookies does not match (could have been changed manually at client side).");
	    return;
	}
	if (!socket.username == username) {
	    console.warn("Username does not match username on this socket - this should never happen!");
	    return;
	}

	var bet = BETS.get(betname);
	if (bet) {
	    var result = bet.settle(parseFloat(settlementPrice));
	    console.log(result);
	    if (result.state == ExecState.ACCEPTED) {
		socket.emit('BET_SETTLE_RESPONSE', {'success': true, 'msg': ''});
		var socketsInRoom = IO.sockets.clients(betname);
		for (i in socketsInRoom) {
		    if (socketsInRoom[i].username == bet.host)
			socketsInRoom[i].emit('BET_SETTLE', {'bet_is_host': true});
		    else
			socketsInRoom[i].emit('BET_SETTLE', {'bet_is_host': false});
		    socketsInRoom[i].emit('BET_UPDATE_SETTLEMENT_TRADE', bet.jsonTradeSettledUpdateMsg(socketsInRoom[i].username));
		    socketsInRoom[i].emit('BET_UPDATE_SETTLEMENT', bet.jsonSettlementUpdateMsg(socketsInRoom[i].username));
		}
		var allSockets = IO.sockets.clients();
		for (i in allSockets) {
		    if (bet.participants.has(allSockets[i].username)) {
			send_bet_list(allSockets[i]);
		    }
		}
	    }
	    else {
		socket.emit('BET_SETTLE_RESPONSE', {'success': false, 'msg': result.msg});
	    }
	}
    });

    socket.on('disconnect', function() {
	console.log("Disconnecting and leaving room " + socket.room);
	if (socket.room) {
	    socket.leave(socket.room);
	}
    });
}

exports.expire = function(betname) {
    var bet = BETS.get(betname);
    if (!bet) {
	console.warn('Cannot find bet ' + betname + ' to be expired');
    }
    else {
	bet.expire();
	var socketsInRoom = IO.sockets.clients(betname);
	for (i in socketsInRoom) {
	    if (socketsInRoom[i].username == bet.host)
		socketsInRoom[i].emit('BET_EXPIRE', {'bet_is_host': true});
	    else
		socketsInRoom[i].emit('BET_EXPIRE', {'bet_is_host': false});
	}
    }
    var allSockets = IO.sockets.clients();
    for (i in allSockets) {
	if (bet.participants.has(allSockets[i].username)) {
	    send_bet_list(allSockets[i]);
	}
    }
}

send_bet_list = function(socket) {
    var active_list = [];
    var expired_list = [];
    var settled_list = [];
    BETS.forEach(function(value, key) {
	if (value.state == BetState.ACTIVE && value.participants.has(socket.username)) {
	    active_list.push(value.name);
	}
	else if (value.state == BetState.EXPIRED && value.participants.has(socket.username)) {
	    expired_list.push(value.name);
	}
	else if (value.participants.has(socket.username)) {
	    settled_list.push(value.name);
	}
    });
    console.log("Emitting " + {'active': active_list, 'expired': expired_list, 'settled': settled_list});
    socket.emit('BET_LIST', {'active': active_list, 'expired': expired_list, 'settled': settled_list});
}
