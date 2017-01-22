'use strict';

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

require('dotenv').config();
var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var morgan = require('morgan');
//const mongoose = require('mongoose');

var router = require('../server/router');
var movieSync = require('../server/services/moviesync.js');
var app = express();

movieSync(function (error) {
    if (error) {
        console.log('Error', error);
    } else {
        console.log('Success', 'Movie synd completed');
    }
});

// -------------------------------
// App setup
app.use(morgan('combined'));
app.use(bodyParser.json({
    type: '*/*'
}));
router(app);

// -------------------------------
// Server setup
var port = process.env.NODE_ENV === 'production' ? process.env.PORT || 8080 : 3001;
var server = http.createServer(app);

// -------------------------------
// Server listen
server.listen(port, function () {
    console.log('Server listening on port ' + port);
});