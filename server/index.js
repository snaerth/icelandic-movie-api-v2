import {} from 'dotenv/config';
import http from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import router from '../server/router';
import movieSync from '../server/services/moviesync';
const app = express();

// movieSync((error) => {
//     if (error) {
//         console.log('Error', error);
//     } else {
//         console.log('Success', 'Movie synd completed');
//     }
// });

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