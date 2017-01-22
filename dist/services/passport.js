'use strict';

var passport = require('passport');
var User = require('../models/user');
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var LocalStategy = require('passport-local');

// Setup options for local strategy
var localOptions = {
    usernameField: 'email'
};

// Create local strategy
var localLogin = new LocalStategy(localOptions, function (email, password, done) {
    // Verify username and passport, call done with that user
    // if correct credentials
    // otherwise call done with false
    User.findOne({ email: email }, function (error, user) {
        if (error) return done(error);
        if (!user) return done(null, false);

        // Compare password to encrypted password
        user.comparePassword(password, function (error, isMatch) {
            if (error) return done(error);
            if (!isMatch) return done(null, false);

            return done(null, user);
        });
    });
});

// Setup options for JWT Strategy
var jwtOptions = {
    jwtFromRequest: ExtractJwt.fromHeader('authorization'),
    secretOrKey: process.env.JWT_SECRET
};

// Create JWT Strategy
var jwtLogin = new JwtStrategy(jwtOptions, function (payload, done) {
    // Check if user ID in the payload exist in database
    User.findById(payload.sub, function (error, user) {
        if (error) return done(err, false);

        // If user exists call done with that user
        if (user) {
            done(null, user);
        } else {
            done(null, false);
        }
    });
});

// Tell passport to use strategy
passport.use(jwtLogin);
passport.use(localLogin);