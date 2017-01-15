require('dotenv').config();
const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');
const router = require('../server/router');
const movieSync = require('../server/services/moviesync.js');
const app = express();

// -------------------------------
// Create the database connection 
var dbUrl = 'mongodb://localhost/movieapi';
mongoose.connect(dbUrl, (error) => {
    if (!error) {
        movieSync((error) => {
            if (error) {
                console.log('Error', error);
            } else {
                console.log('Success', 'Movie synd completed');
            }
        })
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
const port = (process.env.NODE_ENV === 'production') ? process.env.PORT || 8080 : 3001;
const server = http.createServer(app);

// -------------------------------
// Server listen
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});