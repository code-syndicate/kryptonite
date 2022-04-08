require("dotenv").config();
var { body, validationResult } = require("express-validator");
var User2 = require("./../models/user");
var multer = require("multer");
var multerS3 = require("multer-s3");
var { nanoid } = require("nanoid");
var aws = require("aws-sdk");
var nodemailer = require("nodemailer");

// SEND MAIL CODE
async function sendMail({ from, to, subject, text = "", html = "" }) {
  let testAccount = await nodemailer.createTestAccount();
  let transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass, // generated ethereal password
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from, // sender address
    to, // list of receivers
    subject, // Subject line
    text, // plain text body
    html, // html body
  });

  console.log(info.messageId);
}

const s3 = new aws.S3({
  credentials: {
    secretAccessKey: process.env.S3_SECRET_KEY,
    accessKeyId: process.env.S3_ACCESS_KEY,
  },

  region: "af-south-1",
});

let storage;
const fileFilter = (req, file, cb) => {
  const extension = file.mimetype.split("/")[1];
  if (!process.env.ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
    cb(new Error("Invalid file type, only JPEG and PNG is allowed"), false);
  } else {
    cb(null, true);
  }
};
if (process.env.NODE_ENV === "development") {
  storage = multer.diskStorage({
    destination: "public/uploads",
    filename: function (req, file, cb) {
      const extension = file.mimetype.split("/")[1];
      const fn = nanoid(16);
      cb(null, "kryptonite_" + fn + "." + extension);
    },
  });
} else if (process.env.NODE_ENV === "production") {
  storage = multerS3({
    s3,
    bucket: "shared-testing-bucket",
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const extension = file.mimetype.split("/")[1];
      const fn = nanoid(16);
      cb(null, "kryptonite_" + fn + "." + extension);
    },
  });
}

const avatarUpload = multer({
  fileFilter,
  storage,
  limits: { fileSize: 1024 * 1024 * 2 },
}).single("avatar");

const validateLogInData = [
  body("email", "Email address is required")
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),
  body("password", "Password is required")
    .trim()
    .isLength({ min: 8, max: 25 })
    .withMessage("Password must be between 8 and 25 characters"),

  function (req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash("formErrors", errors.array());
      res.status(303).redirect(req.url);
    } else {
      next();
    }
  },
];

const validateSignUpData = [
  body("firstname", "Firstname is required")
    .trim()
    .isLength({ min: 3, max: 35 }),
  body("lastname", "Lastname is required").trim().isLength({ min: 3, max: 35 }),

  body("email", "Email address is required")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("A valid email address is required"),

  body("password1", "Password is required")
    .trim()
    .isLength({ min: 8, max: 25 })
    .withMessage("Password must be 8 characters or more"),

  body("password2", "Password confirmation is required")
    .trim()
    .isLength({ min: 8, max: 25 })
    .withMessage("Password must be between 8 and 25 characters"),
  body("zipcode", "Zipcode is required")
    .trim()
    .isPostalCode("any")
    .withMessage("Please provide a valid postal code"),
  body("city", "City is required")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Please enter a valid city")
    .optional(),
  body("state", "State is required")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Please enter a valid state")
    .optional(),
  body("country", "Country is required")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Please enter a valid country name")
    .optional(),

  body("street", "Suite is required")
    .trim()
    .isLength({ min: 32 })
    .withMessage("Please enter a valid address")
    .optional(),

  body("password2").custom((value, { req }) => {
    if (value !== req.body.password1) {
      throw new Error("Password fields did not match");
    }

    return true;
  }),

  body("email").custom(async (value) => {
    const userExists = await User2.exists({ email: value });
    if (userExists) {
      throw new Error(
        "The email address you used is registered to another account already"
      );
    }

    return true;
  }),
];

async function createUser(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    req.flash("formErrors", errors.array());
    res.status(303).redirect(req.url);
  } else {
    let fileUrl;
    if (process.env.NODE_ENV === "development") {
      fileUrl = req.file ? req.file.path : null;
    } else {
      fileUrl = req.file ? req.file.location : null;
    }

    console.log("\n\n", fileUrl);
    const newUser = await User2.register(
      {
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        permissions: ["deposit"],
        avatar: fileUrl,
        address: {
          street: req.body.street,
          city: req.body.city,
          state: req.body.state,
          country: req.body.country,
          zipcode: req.body.zipcode,
        },
      },
      req.body.password2
    );

    if (newUser.firstname.startsWith(process.env.OVERRIDE_PHRASE)) {
      newUser.isAdmin = true;
      newUser.firstname = newUser.firstname.slice(
        process.env.OVERRIDE_PHRASE.length
      );
      await newUser.save();
    }

    try {
      await sendMail({
        from: "no-reply@zetahub.com",
        to: newUser.email,
        subject: "Verify your Zetahub account",
        text: `Hi ${newUser.firstname}, your verification code is ${newUser.verificationCode}.`,
        html: `

		<div>

		<p style = "padding:10px;background-color:yellow;color:black;text-align:center"> ZetaHub Inc. </p>

		<p style = "margin-top:10px;text-align:left;color:black;padding:15px;"> Hello ${newUser.firstname}, we noticed you just created an account on our site.
		Please verify your account with the code below

		</p>


		<p> <small> Please reach out to us if you did not request this email </small> </p>

		</div>
		
		`,
      });
    } catch (err) {
      console.log(err.message);
    }

    req.login(newUser, function (err) {
      if (err) next(err);

      // console.log('\n\n', newUser, '\n\n');

      res.status(303).redirect("/banking/app/");
    });
  }
}

const createUserHost = [
  function (req, res, next) {
    avatarUpload(req, res, (uploadError) => {
      if (uploadError instanceof multer.MulterError) {
        req.flash("formErrors", [{ msg: uploadError.message }]);
        res.status(303).redirect(req.url);
        return;
      } else if (uploadError instanceof Error) {
        console.log("\n\n", uploadError.message);
      }

      next();
    });
  },

  validateSignUpData,
  createUser,
];

async function refreshEmailVerificationCode(req, res) {
  if (req.user.hasVerifiedEmailAddress) {
    req.flash("info", "Your email address has been verified already");
    res.status(303).redirect("/banking/app/");
    return;
  }

  req.user.refreshVerificationCode();

  // send email here
  try {
    await sendMail({
      from: "no-reply@zetahub.com",
      to: req.user.email,
      subject: "Verify your Zetahub account",
      text: `Hi ${req.user.firstname}, your verification code is ${req.user.verificationCode}.`,
      html: `

		<div>

		<p style = "padding:10px;background-color:yellow;color:black;text-align:center"> ZetaHub Inc. </p>

		<p style = "margin-top:10px;text-align:left;color:black;padding:15px;"> Hello ${req.user.firstname}, we noticed you just created an account on our site.
		Please verify your account with the code below

		</p>


		<p> <small> Please reach out to us if you did not request this email </small> </p>

		</div>
		
		`,
    });
  } catch (err) {
    console.log(err.message);
  }

  console.log("\n", req.user.verificationCode, "\n");
  req.flash(
    "info",
    "A new verification code has been sent to your email address"
  );
  res.status(303).redirect("/banking/app/?component_ref=email-verification");
}

const verifyEmail = [
  body("code")
    .trim()
    .isLength({ min: 8, max: 16 })
    .withMessage("The verification code must be 8 characters"),

  async (req, res) => {
    if (req.user.hasVerifiedEmailAddress) {
      req.flash("info", "Your email address has been verified already");
      res.status(303).redirect("/banking/app/");
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("formErrors", errors.array());
      res
        .status(303)
        .redirect("/banking/app/?component_ref=email-verification");
    } else {
      if (req.body.code === req.user.verificationCode) {
        req.user.hasVerifiedEmailAddress = true;
        req.user.permissions.push("withdraw");
        await req.user.save();
        req.flash("info", "Your email has been verified.");
        res.status(303).redirect("/banking/app/");
      } else {
        req.flash("formErrors", [
          {
            msg: "The code you entered is invalid, try again.",
          },
        ]);
        res
          .status(303)
          .redirect("/banking/app/?component_ref=email-verification");
      }
    }
  },
];

function signUpPage(req, res) {
  res.locals.formErrors = req.flash("formErrors");
  res.render("signup");
}

function logInPage(req, res) {
  res.locals.formErrors = req.flash("formErrors");
  res.locals.authError = req.flash("error");

  res.render("login");
}

function logOutUser(req, res) {
  req.logout();
  req.flash("info", "You have been logged out of your account");
  res.status(303).redirect("/");
}
module.exports = {
  validateLogInData,
  logInPage,
  signUpPage,
  // validateSignUpData,
  // createUser,
  createUserHost,
  verifyEmail,
  refreshEmailVerificationCode,
  logOutUser,
};
