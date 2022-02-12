var mongoose = require('mongoose');
var {nanoid} = require('nanoid');

function genCode() {
	return nanoid(16);
}

const depositSchema = mongoose.Schema({
	date: {type: Date, default: Date.now},
	ref: {
		type: mongoose.Types.ObjectId,
		default: mongoose.Types.ObjectId,
		unique: true,
	},
	amount: {type: Number, min: 0},
	description: String,
	details: String,
	approved: {type: Boolean, default: false},
	client: {type: mongoose.Types.ObjectId, ref: 'User2'},
	walletType: {type: String, required: true},
	walletAdrress: {type: String, required: true, min: 24},
});

const withdrawalSchema = mongoose.Schema({
	date: {type: Date, default: Date.now},
	ref: {
		type: mongoose.Types.ObjectId,
		default: mongoose.Types.ObjectId,
		unique: true,
	},
	amount: {type: Number, min: 0},
	approved: {type: Boolean, default: false},
	walletType: {type: String, required: true},
	details: String,
	pin: String,
	client: {type: mongoose.Types.ObjectId, ref: 'User2'},
	walletAdrress: {type: String, required: true, min: 24},
});

const authPinSchema = mongoose.Schema({
	pin: {
		type: String,
		unique: true,
		minLength: 4,
		default: genCode,
	},
	client: {type: mongoose.Types.ObjectId, ref: 'User2'},
	dateCreated: {type: Date, default: Date.now},
	hasBeenUsed: {type: Boolean, default: false},
	withdrawal: {
		type: mongoose.Types.ObjectId,
		ref: 'Withdrawal2',
		unique: true,
	},
});

const Deposit2 = mongoose.model('Deposit2', depositSchema);
const Withdrawal2 = mongoose.model('Withdrawal2', withdrawalSchema);
const AuthPin2 = mongoose.model('AuthPin2', authPinSchema);

module.exports = {
	Deposit2,
	Withdrawal2,
	AuthPin2,
};
