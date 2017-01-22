"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * Validates email string
 * @param {String} email - Email string
 * @returns true if valid, false otherwise 
 */
exports.validateEmail = function (email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
};

/**
 * Deep trims every property in object
 * @param {Object} obj - incoming argument to trim
 */
exports.deepTrim = function deepTrim(obj) {
    for (var prop in obj) {
        var value = obj[prop],
            type = typeof value === "undefined" ? "undefined" : _typeof(value);
        if (value != null && (type == "string" || type == "object") && obj.hasOwnProperty(prop)) {
            if (type == "object") {
                deepTrim(obj[prop]);
            } else {
                obj[prop] = obj[prop].trim();
            }
        }
    }
};

/**
 * Splits array into chunks
 * For example splitToChunks([1,2,3,4,5,6,7,8,9], 3)
 * @param {Array} arr - Array
 * @param {Int} chunk - Integer number
 * @returns a new array divided into chunks size[[1,2.3],[4,5,6],[7,8,9]] 
 */
exports.splitToChunks = function (arr, chunk) {
    var chunk = chunk;
    var newarr = new Array();

    for (var i = 0; i < arr.length; i = i + chunk) {
        newarr.push(arr.slice(i, i + chunk));
    }

    return newarr;
};