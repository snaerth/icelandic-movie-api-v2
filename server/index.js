import {} from 'dotenv/config';
import path from 'path';
import { Server } from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import router from '../server/router';
import movieSync from '../server/services/moviesync';

// -------------------------------
// Initialize the server and configure support for ejs templates
const app = express();
const server = new Server(app);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// -------------------------------
// App setup
app.use(morgan('combined'));
// define the folder that will be used for static assets
app.use(express.static(path.join(__dirname, 'client/static'))); 
app.use(bodyParser.json({
    type: '*/*'
}));

// -------------------------------
// Setup all routes
router(app);

// -------------------------------
// Start the server
const port = process.env.PORT || 3000;
const env = process.env.NODE_ENV || 'production';
server.listen(port, err => {
  if (err) {
    return console.error(err);
  }
  console.info(`Server running on http://localhost:${port} [${env}]`);
});