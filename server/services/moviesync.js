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
    let plotsArr = []; // Array of movie plots object [{imdb:'tt0317248',text: 'This is movie plot text'}, ...]
    let trailersArr = [] // Array of trailer information for movie [{imdb:'tt0317248',data: [{...}, {...}, ...]]
    let omdbArr = [] // Array of omdb information for movie [{imdb:'tt0317248',data: {...}, ...]

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
            plotsArr = plots;

            // Add plot to showtime movies and upcoming movies
            _.forEach(moviesByDay, (day, key) => {
                day.data = addPlotToMovies(day.data, plotsArr);
            });

            upcomingMovies.data = addPlotToMovies(upcomingMovies.data, plotsArr);

            return getTrailers(mergedList); // Get trailers for each movie in array
        }).then(trailersData => {
            trailersArr = trailersData;
            return getOmdbData(mergedList); // Get omdb information for each movie in array
        }).then(omdbData => {
            omdbArr = omdbData;
        }).catch(error => console.error(error));
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
 * Gets trailers for multiple movies from TMDB API
 * @param {Array} movies - Array of movie objects
 * @returns {Promise} promise - When all promises have resolved then trailersArr is returned
 */
function getTrailers(movies) {
    return new Promise((resolve, reject) => {
        let trailersArr = []; // Contains all trailers object
        let promises = [];

        for (let i = 0; i < movies.length; i++) {
            const movie = movies[i];

            if (movie.ids && movie.ids.imdb) {
                const imdbId = formatImdbId(movie.ids.imdb);
                const url = `https://api.themoviedb.org/3/movie/${imdbId}/videos?api_key=${apiKeyTmdb}`;
                const delay = 400 * i; // TMDB has 30 request per 10 seconds

                const request = getTrailersRequest(url, imdbId, delay)
                    .then(trailer => {
                        if (trailer) {
                            trailersArr.push(trailer);
                        }
                    })
                    .catch(error => reject(error));
                promises.push(request);
            }
        }

        Promise.all(promises)
            .then(() => resolve(trailersArr))
            .catch(error => reject(error));
    });
}

/**
 * Gets trailers from TMDB service by specific imdbID
 * @param {String} url - url
 * @param {String} imdbId - IMDB id
 * @param {Int} delay - Delay in milliseconds
 * @returns {Promise} promise - Promise witch returns trailer object
 */
function getTrailersRequest(url, imdbId, delay) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            fetch(url)
                .then(res => res.json())
                .then(trailers => {
                    if (!trailers && !trailers.results) {
                        return resolve();
                    }

                    const trailersObj = createTrailerObject(imdbId, trailers.results);
                    return resolve(trailersObj);
                }).catch(error => reject(error));
        }, delay);
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
 * Iterates movies objects and make request to OMDB API for each movie
 * Creates a omdb array to store the omdb API data
 * @param {Array} movies - Array of movie objects
 * @returns {Promise} promise - When all promises have resolved then omdbArr is returned
 */
function getOmdbData(movies) {
    return new Promise((resolve, reject) => {
        let omdbArr = []; // Contains all trailers object
        let promises = [];

        for (let i = 0; i < movies.length; i++) {
            const movie = movies[i];

            if (movie.ids && movie.ids.imdb) {
                const imdbId = formatImdbId(movie.ids.imdb);
                const url = `http://www.omdbapi.com/?i=${imdbId}&plot=true&tomatoes=true&r=json`;

                const request = fetch(url)
                    .then(res => res.json())
                    .then(data => {
                        omdbArr.push({
                            imdb: data.imdbID,
                            data: data
                        });
                    }).catch(error => reject(error));

                promises.push(request);
            }
        }

        Promise.all(promises)
            .then(() => resolve(omdbArr))
            .catch(error => reject(error));
    });
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

/**
 * Adds tt before imdb id if not exist
 * @param {String} imdbId - IMDB id
 * @returns {String} imdb id formatted
 */
function formatImdbId(imdbId) {
    return imdbId.indexOf('tt') > -1 ? imdbId : `tt${imdbId}`;
}