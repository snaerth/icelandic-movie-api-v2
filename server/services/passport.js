const passport = require('passport');
const User = require('../models/user');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const LocalStategy = require('passport-local');

// Setup options for local strategy
const localOptions = {
    usernameField: 'email'
};

// Create local strategy
const localLogin = new LocalStategy(localOptions, (email, password, done) => {
    // Verify username and passport, call done with that user
    // if correct credentials
    // otherwise call done with false
    User.findOne({email}, (error, user) => {
        if(error) return done(error);
        if(!user) return done(null, false);

        // Compare password to encrypted password
        user.comparePassword(password, (error, isMatch) => {
            if(error) return done(error);
            if(!isMatch) return done(null, false);
        
            return done(null, user);
        });
    });
});

// Setup options for JWT Strategy
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromHeader('authorization'),
    secretOrKey: process.env.JWT_SECRET
};

// Create JWT Strategy
const jwtLogin = new JwtStrategy(jwtOptions, (payload, done) => {   
    // Check if user ID in the payload exist in database
    User.findById(payload.sub, (error, user) => {
        if(error) return done(err, false);

        // If user exists call done with that user
        if(user) {
            done(null, user);
        } else {
            done(null, false);
        }
    })
});

// Tell passport to use strategy
passport.use(jwtLogin);
passport.use(localLogin);