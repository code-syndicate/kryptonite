require('dotenv').config();
const User2 = require('./models/user');
const {Deposit2, Withdrawal2, AuthPin2} = require('./models/transaction');
const Notification2 = require('./models/notification');
const startDb = require('./models/index');

startDb();

async function Flush() {
	await Deposit2.deleteMany({}).exec();
	await Withdrawal2.deleteMany({}).exec();
	await Notification2.deleteMany({}).exec();
	await AuthPin2.deleteMany({}).exec();
	await User2.deleteMany({}).exec();
	console.log('\n\nDATABASE FLUSHED\n\n');
}

Flush();
