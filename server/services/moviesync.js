const fetch = require('node-fetch');
const {
    splitToChunks
} = require('./utils');
const _ = require('lodash');
const apiKeyKvikmyndir = process.env.API_KEY_KVIKMYNDIR;
const apiKeyTmdb = process.env.API_KEY_TMDB;

module.exports = (callback) => {
    let allMovies = []; // Contains all movies for 5 days in one big array [movie1, movie2, movie2, ...]
    let moviesByDay = []; // Contains all movies for 5 days [[day0]], [day1]], [day2]], ...]
    let mergedList = []; // allMovies array merged into uniqe movie array
    let upcomingMovies = {
        date: null,
        type: 'upcoming',
        data: []
    }; // Contains upcoming movies { ... ,data: [movie1, movie2, movie2, ...] }

    getKvikmyndir()
        .then(data => {
            moviesByDay = data;
            allMovies = mergeMovieArrays(data);
            mergedList = _.uniqBy(allMovies, 'id'); // Find uniqe movies by id in array, 

            return getUpcoming();
        }).then(data => {
            upcomingMovies.date = Date.now();
            upcomingMovies.data = data
            mergedList = _.unionBy(mergedList, data, 'id');

            return getPlotForMovies(mergedList); // Get plot for each movie in array
        }).then(plots => {
            // Add plot to showtime movies and upcoming movies
            _.forEach(moviesByDay, (day, key) => {
                day.data = addPlotToMovies(day.data, plots);
            });

            upcomingMovies.data = addPlotToMovies(upcomingMovies.data, plots);

            return getTrailers(mergedList);
        }).then(trailers => {
            console.log(trailers);
        }).catch(error => console.error(error));
}

/**
 * Gets trailers for multiple movies from TMDB API
 * @param {Array} movies - Array of movie objects
 * @returns {Promise} promise - When all promises have resolved then trailersArr is returned
 */
function getTrailers(movies) {
    return new Promise((resolve, reject) => {
        let trailersArr = []; // Contains all trailers object
        let promisesOuter = [];
        const maxLength = 30; // TMDB has 30 request per 10 seconds

        if (movies.length > maxLength) {
            var movieChunks = splitToChunks(movies, maxLength);

            for (let i = 0; i < movieChunks.length; i++) {
                let promisesInner = [];

                setTimeout(() => {
                    _.forEach(movieChunks[i], (movie) => {
                        if (movie.ids && movie.ids.imdb) {
                            const imdbId = movie.ids.imdb.indexOf('tt') > -1 ? movie.ids.imdb : `tt${movie.ids.imdb}`;
                            const url = `https://api.themoviedb.org/3/movie/${imdbId}/videos?api_key=${apiKeyTmdb}`;

                            const request = fetch(url)
                                .then(res => res.json())
                                .then(trailers => {
                                    if (trailers.results && trailers.results.length > 0) {
                                        const trailersObj = createTrailerObject(movie.ids.imdb, trailers.results);
                                        trailersArr.push(trailersObj);
                                    }
                                }).catch(error => {
                                    return reject(error);
                                });

                            promisesInner.push(request);
                        }
                    });
                }, (i === 0) ? 0 : 12000); // Set the request limit to 12 seconds because of TMDB request limit
            }
        }

        const promiseAll = Promise.all(
            promisesOuter.map((promisesInner) => {
                return Promise.all(promisesInner);
            })
        );

        promiseAll
            .then(() => resolve(trailersArr))
            .catch(error => reject(error));
    });
}

/**
 * Creates new trailer object from TMDB trailer object
 * @param {String} imdbId - Imdb id
 * @param {Array} trailers - Array of trailer objecs
 * @returns {Object} trailersObj - newly created trailer object
 */
function createTrailerObject(imdbId, trailers) {
    let trailersObj = {
        imdb: imdbId,
        data: []
    };

    _.forEach(trailers, (trailer) => {
        trailersObj.data.push({
            id: trailer.id,
            url: `https://www.youtube.com/embed/${trailer.key}?rel=0`,
            size: trailer.size,
            name: trailer.name
        });
    });

    return trailersObj;
}

/**
 * Makes get request to Kvikmyndir.is API to get movie showtimes
 * @returns {Promise} Promise - the promise object
 */
function getKvikmyndir() {
    return new Promise((resolve, reject) => {
        let movieArr = []; // Contains all movies for 5 days [[day0]], [day1]], [day2]], ...]
        let promises = [];

        for (let i = 0; i < 5; i++) {
            const url = `http://kvikmyndir.is/api/showtimes_by_date/?key=${apiKeyKvikmyndir}&dagur=${i}`;

            const request = fetch(url)
                .then(res => res.json())
                .then(data => {
                    movieArr.push({
                        day: i,
                        date: Date.now(),
                        type: 'showtimes',
                        data: data
                    });
                }).catch(error => reject(error));

            promises.push(request);
        }

        Promise.all(promises)
            .then(() => resolve(movieArr))
            .catch(error => reject(error));
    });
}

/**
 * Makes get request to Kvikmyndir.is API to get upcoming movies
 * @returns {Promise} Promise - the promise object
 */
function getUpcoming() {
    return new Promise((resolve, reject) => {
        const url = `http://kvikmyndir.is/api/movie_list_upcoming/?key=${apiKeyKvikmyndir}&count=100`;

        fetch(url)
            .then(res => res.json())
            .then(data => resolve(data))
            .catch(error => reject(error));
    });
}

/**
 * Makes get request to Kvikmyndir.is API and gets additonal information about movie
 * Specifically gets plot for movie
 * @param {Array} movies - Array of movie objects
 * @returns {Promise} Promise - the promise object
 */
function getPlotForMovies(movies) {
    return new Promise((resolve, reject) => {
        let moviesWithPlot = [];
        let promises = [];

        for (let i = 0; i < movies.length; i++) {
            const imdbId = movies[i].ids.imdb;
            const url = `http://kvikmyndir.is/api/movie/?imdb=${imdbId}&key=${apiKeyKvikmyndir}`;
            const request = fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (data.plot && data.imdb) {
                        moviesWithPlot.push({
                            imdb: data.imdb,
                            text: data.plot
                        });
                    }
                })
                .catch(err => console.error(err))

            promises.push(request);
        }

        Promise.all(promises)
            .then(() => resolve(moviesWithPlot))
            .catch(error => reject(error));
    });
}

/**
 * Adds plot property to movies
 * @param {Array} movies - Array of movie objects
 * @param {Array} plots - Array of plot objects
 * @returns {Array} movies - movies with plot object
 */
function addPlotToMovies(movies, plots) {
    _.forEach(movies, function (movie, key) {
        if (movie.ids && movie.ids.imdb) {
            const matchedPlot = _.find(plots, o => o.imdb == movie.ids.imdb);
            movie.plot = {
                is: matchedPlot ? matchedPlot.text : '',
                en: ''
            };
        }
    });

    return movies;
}

/**
 * Iterates array of arrays, and puts those object into new array
 * @param {Array} array
 * @returns {Array} newArray
 */
function mergeMovieArrays(array) {
    let newArray = [];

    // Push each movie into array
    for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < array[i].data.length; j++) {
            newArray.push(array[i].data[j]);
        }
    }

    return newArray;
}