'use strict';

var _require = require('../services/utils'),
    validateEmail = _require.validateEmail;

var User = require('../models/user');
var jwt = require('jwt-simple');

// User signup route
exports.signup = function (req, res, next) {
    var email = req.body.email;
    var password = req.body.password;
    var message = req.body.message;

    if (!email || !password || !message) {
        return res.status(422).send({
            error: 'You must provide email, password and message'
        });
    }

    // Validate email
    if (!validateEmail(email)) {
        return res.status(422).send({
            error: email + ' is not a valid email'
        });
    }

    // Check if password length is longer then 6 characters
    if (password.length < 6) {
        return res.status(422).send({
            error: 'The password must be of minimum length 6 characters'
        });
    }

    // See if user with given email exists
    User.findOne({
        email: email
    }, function (error, existingUser) {
        if (error) return next(error);

        // If a user does exist, return error
        if (existingUser) {
            return res.status(422).send({
                error: 'Email is in use'
            });
        }

        // If a user does not exist, create and save new user
        var user = new User({
            email: email,
            password: password,
            message: message
        });

        user.save(function (error) {
            if (error) {
                return next(error);
            }

            // Respond to request that user was created
            res.json({
                token: tokenForUser(user)
            });
        });
    });
};

// User signin route
exports.signin = function (req, res, next) {
    res.send({
        token: tokenForUser(req.user)
    });
};

// Gets token for user
// @param {Object} user - User object
// @returns {String} token - Newly created token
function tokenForUser(user) {
    var timestamp = new Date().getTime();
    return jwt.encode({
        sub: user.id,
        iat: timestamp
    }, process.env.JWT_SECRET);
}