var uuid = require('node-uuid');

function Trade(bet, longParty, shortParty, price, size, doSave) {
    this.bet = bet;
    this.longParty = longParty;
    this.shortParty = shortParty;
    this.price = price;
    this.size = size;
    this.id = uuid.v1();
    this.tradeTime = new Date();
    this.doSave = doSave;
    this.save();
}

Trade.prototype.save = function() {
    if (this.doSave) {
	POSTGRES_CLIENT.query({text: 'INSERT INTO trades(bet_name,long_user,short_user,uid,price,size,time) VALUES ($1, $2, $3, $4, $5, $6, $7)', values: [this.bet.name, this.longParty, this.shortParty, this.id, this.price, this.size, this.tradeTime]}, function(err, result) {
	    if (err) {
		console.log('Error when saving trade update: ' + err);
		return;
	    }
	});
    }
}

Trade.prototype.settle = function(settlementPrice) {
    // Positive if long party made money
    var pnl = (settlementPrice - this.price) * this.size;
    return Math.round(pnl * 100) / 100;
}

module.exports = Trade;
