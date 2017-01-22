/* eslint no-console: 0 */
require('babel/register');
import {} from 'dotenv/config';
import http from 'http';
import express from 'express';
import compression from 'compression';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Router, RouterContext, match } from 'react-router';
import Helmet from 'react-helmet';
import { Provider } from 'react-redux';
import routes, {NotFoundPage} from '../server/routes';
import configureStore from '../server/store/configureStore';
import debug from 'utils/debug';
import color from 'cli-color'; // eslint-disable-line
import bodyParser from 'body-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import router from '../server/router';
import movieSync from '../server/services/moviesync';

const release = (process.env.NODE_ENV === 'production');
const port = (parseInt(process.env.PORT, 10) || 3000) - !release;
const app = express();

// movieSync((error) => {
//     if (error) {
//         console.log('Error', error);
//     } else {
//         console.log('Success', 'Movie synd completed');
//     }
// });

// Set view engine
app.set('views', '../server/views');
app.set('view engine', 'ejs');
app.use(compression());
app.use(express.static('./client/assets/favicon'));
app.use(express.static('./build'));
app.use(morgan('combined'));
app.use(bodyParser.json({
    type: '*/*'
}));

// Routes
router(app);


// Route handler that rules them all!
app.get('*', (req, res) => {
  debug(color.cyan('http'), '%s - %s %s', req.ip, req.method, req.url);

  // Do a router match
  match({
    routes: (<Router>{routes}</Router>),
    location: req.url,
  },
  (err, redirect, props) => {

    // Sanity checks
    if (err) {
      return res.status(500).send(err.message);
    } else if (redirect) {
      return res.redirect(302, redirect.pathname + redirect.search);
    } else if (props.components.some(component => component === NotFoundPage)) {
      res.status(404);
    }

    fetchMovies()
			.then((data) => {
				// Create a new Redux store instance
				const store = configureStore({ movies: data });
				// Grab the initial state from our Redux store
				const initialState = JSON.stringify(store.getState());
                const head = Helmet.rewind();
				// Render the component to a string
				const renderedRoot = renderToString(
					<Provider store={store}>
						<RouterContext {...props}/>
					</Provider>
				);

                res.render('index', {
                    includeStyles: release,
                    includeClient: true,
                    renderedRoot,
                    initialState,
                    title: head.title.toString(),
                    meta: head.meta.toString(),
                    link: head.link.toString(),
                });
        
			})
			.catch((error) => {
				debug(color.red('Error: '), error);
			});
  });
});

function fetchMovies() {
	return new Promise((resolve, reject) => {
		resolve(require('../client/data/movies0.json'));
	});
}

// -------------------------------
// Server setup
// Create HTTP Server
const server = http.createServer(app);

// Start
server.listen(port, err => {
  if (err) {
    throw err;
  } else {
    debug(color.cyan('http'), `🚀  started on port ${port}`);
  }
});