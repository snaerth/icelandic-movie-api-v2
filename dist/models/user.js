'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

// Define user model
var userSchema = new Schema({
    email: {
        type: String,
        unique: true,
        lowercase: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    }
});

// On save, encrypt password
// Before saving user model, run this function
userSchema.pre('save', function (next) {
    var user = this;

    // Generate a salt
    bcrypt.genSalt(10, function (error, salt) {
        if (error) return next(error);

        // Encrypt our password using the salt above
        bcrypt.hash(user.password, salt, null, function (error, hash) {
            if (error) return next(error);

            // Override plain password with encrypted password
            user.password = hash;
            return next(user);
        });
    });
});

// Compare password to encrypted password
userSchema.methods.comparePassword = function (candidatePassword, callback) {
    bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
        if (err) return callback(err);
        callback(null, isMatch);
    });
};

// Create model class
var ModelClass = mongoose.model('user', userSchema);

module.exports = ModelClass;