const User2 = require('./../models/user');
const {Deposit2, Withdrawal2, AuthPin2} = require('./../models/transaction');
const Notification2 = require('./../models/notification');
const {body, validationResult} = require('express-validator');

function logIn(req, res) {
	res.locals.authError = req.flash('error');
	res.locals.formErrors = req.flash('formErrors');
	res.render('admin_login');
}

async function deleteUser(req, res) {
	const id = req.params.clientId;
	await Withdrawal2.deleteMany({client: id}).exec();
	await Deposit2.deleteMany({client: id}).exec();
	await Notification2.deleteMany({listener: id}).exec();
	await AuthPin2.deleteMany({client: id}).exec();

	await User2.findByIdAndDelete(id).exec();

	res.redirect('/admin/overview/?ui=users');
}

async function overview(req, res) {
	let UI = req.query.ui || 'main';

	const uis = ['main', 'users', 'deposits', 'withdrawals'];

	if (!uis.includes(UI)) UI = 'main';

	const clients = await User2.find({}).exec();
	const deposits = await Deposit2.find({}).populate('client').exec();
	const withdrawals = await Withdrawal2.find({}).populate('client').exec();

	res.locals.authError = req.flash('error');
	res.locals.formErrors = req.flash('formErrors');

	res.render('admin_overview', {
		clients,
		deposits,
		withdrawals,
		ui: UI,
		user: req.user,
	});
}

const editClient = [
	body('wallet', 'Wallet balance is required')
		.notEmpty()
		.isNumeric()
		.withMessage('Please enter a valid wallet amount'),
	body('bonus', 'Bonus balance is required')
		.notEmpty()
		.isNumeric()
		.withMessage('Please enter a valid bonus amount'),
	body('profit', 'Profit balance is required')
		.notEmpty()
		.isNumeric()
		.withMessage('Please enter a valid profit amount'),
	async function (req, res) {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			req.flash('formErrors', errors.array());
			res.redirect('/admin/overview/?ui=users');
			return;
		}

		let client = await User2.findById(req.body.clientId).exec();
		client.wallet = req.body.wallet;
		client.bonus = req.body.bonus;
		client.profits = req.body.profit;

		await client.save();
		req.flash(
			'info',
			` Client ${client.email} record updated successfully`
		);
		res.redirect('/admin/overview/?ui=users');
	},
];

module.exports = {
	logIn,
	overview,
	editClient,
	deleteUser,
};
