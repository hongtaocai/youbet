/**
 * Module dependencies.
 */

var fs = require('fs');
var pg = require('pg');
var read = require('read');
var express = require('express');
var http = require('http');
var path = require('path');
var util = require('util');
var socketio = require('socket.io');

var Consts = require('./node/consts.js');
var Socket = require('./node/socket.js');

var app = express();

var account_handlers = require('./handlers/account_handlers.js');
var bet_handlers = require('./handlers/bet_handlers.js');
var index_handlers = require('./handlers/index_handlers.js');

// all environments
app.set('port', process.env.PORT || 8080);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', index_handlers.index_get);
app.get('/signup', account_handlers.signup_get);
app.post('/signup', account_handlers.signup_post);
app.get('/signin', account_handlers.signin_get);
app.post('/signin', account_handlers.signin_post);
app.get('/logout', account_handlers.logout_get);
app.get('/home', bet_handlers.home_get);

var server = http.createServer(app);
var io = socketio.listen(server);

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

read({prompt: 'Password: ', silent: true}, function(err, password) {
read({prompt: 'Security key: ', silent: true}, function(err, seckey) {
    var CONN_STRING = util.format(Consts.RDS_POSTGRES_CONN_STRING, password);
    SECURITY_KEY = seckey;
    POSTGRES_CLIENT = new pg.Client(CONN_STRING);
    POSTGRES_CLIENT.connect();
});
});

// socket.io
io.sockets.on('connection', Socket.server);
