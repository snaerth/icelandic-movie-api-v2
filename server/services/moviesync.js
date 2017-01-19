const fetch = require('node-fetch');
const _ = require('lodash');
const apiKeyKvikmyndir = process.env.API_KEY_KVIKMYNDIR;
const apiKeyTmdb = process.env.API_KEY_TMDB;

const MongoClient = require('mongodb').MongoClient;

module.exports = (callback) => {
    // Contains all movies for 5 days in one big array [movie1, movie2, movie2, ...]
    let allMovies = [];
    // Contains all movies for 5 days [[day0]], [day1]], [day2]], ...]
    let moviesByDay = [];
    // allMovies array merged into uniqe movie array
    let mergedList = [];
    // Contains upcoming movies { ... ,data: [movie1, movie2, movie2, ...] }
    let upcomingMovies = {
        date: null,
        type: 'upcoming',
        data: []
    };
    // Array of movie plots object [{imdb:'tt0317248',text: 'This is movie plot text'}, ...]
    let plotsArr = [];
    // Array of trailer information for movie [{imdb:'tt0317248',data: [{...}, {...}, ...]]
    let trailersArr = [];
    // Array of omdb information for movie [{imdb:'tt0317248',data: {...}, ...]
    let omdbArr = [];
    // Array of images objects [{imdb:'tt0317248',data: {...}, ...]
    let imagesArr = [];

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

            return getTmdbData(mergedList, getTrailersRequest, 'videos'); // Get trailers for each movie in array
        }).then(trailersData => {
            trailersArr = trailersData;

            return getTmdbData(mergedList, getImagesRequest, 'images'); // Get trailers for each movie in array
        }).then(imagesData => {
            imagesArr = imagesData;

            return getOmdbData(mergedList); // Get omdb information for each movie in array
        }).then(omdbData => {
            omdbArr = omdbData;

            _.forEach(moviesByDay, (day, key) => {
                day.data = extendMoviesObjects(day.data, plotsArr, trailersArr, imagesArr, omdbArr);
            });


            upcomingMovies.data = extendMoviesObjects(upcomingMovies.data, plotsArr, trailersArr, imagesArr, omdbArr);

            MongoClient.connect('mongodb://snaerth:JaN.C5.1@ds056698.mongolab.com:56698/icelandicmoviesapi', function (err, db) {
                insertDocument(db, moviesByDay[0].data, function () {
                    db.close();
                });
            });

        }).catch(error => console.error(error));
}



function insertDocument(db, documents, callback) {
    db.collection('movies').insert(documents, function (err, result) {
        console.log("Inserted a document into the restaurants collection.");
        callback();
    });
};


/**
 * Extends movie objects with plots, trailers, images and omdb objects
 * @param {Array} movies - Array of movie objects
 * @param {Array} plots - Array of plot objects
 * @param {Array} trailers - Array of trailers objects
 * @param {Array} images - Array of images objects
 * @param {Array} omdb - Array of omdb objects
 * @returns {Array} movies - Array of extended movie objects
 */
function extendMoviesObjects(movies, plots, trailers, images, omdb) {
    _.forEach(movies, (movie) => {
        movie.ids.imdb = formatImdbId(movie.ids.imdb);
        const imdbId = movie.ids.imdb;

        // PLOTS
        if (plots && plots.length > 0) {
            const matchedPlot = _.find(plots, plot => plot.imdb == imdbId);
            movie.plot = {
                is: matchedPlot ? matchedPlot.text : '',
                en: ''
            };
        }

        // TRAILERS
        if (trailers && trailers.length > 0) {
            const matchedTrailer = _.find(trailers, trailer => trailer.imdb == imdbId);

            if (matchedTrailer && matchedTrailer.data) {
                movie.trailers = matchedTrailer.data;
            }
        }

        // IMAGES
        if (images && images.length > 0) {
            const matchedImages = _.find(images, image => image.imdb == imdbId);

            if (matchedImages && matchedImages.backdrops && matchedImages.posters) {
                movie.images = {
                    backdrops: matchedImages.backdrops,
                    posters: matchedImages.posters
                };
            }
        }

        // REFACTOR propertyes
        // ACTORS
        if (movie.actors_abridged && movie.actors_abridged.length > 0) {
            const actors = [];

            _.forEach(movie.actors_abridged, actor => {
                if (actor.name) {
                    actors.push(actor.name);
                }
            });

            movie.actors = actors;
            delete movie.actors_abridged;
        }

        // DIRECTORS
        if (movie.directors_abridged && movie.directors_abridged.length > 0) {
            const directors = [];

            _.forEach(movie.directors_abridged, director => {
                if (director.name) {
                    directors.push(director.name);
                }
            });

            movie.directors = directors;
            delete movie.directors_abridged;
        }

        if (movie.alternativeTitles) delete movie.alternativeTitles;
    });

    return movies;
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
 * Gets trailers or videos for multiple movies from TMDB API
 * @param {Array} movies - Array of movie objects
 * @param {Function} fn - Function to run
 * @param {String} type - Request type in url videos or images
 * @returns {Promise} promise - When all promises have resolved then trailersArr is returned
 */
function getTmdbData(movies, fn, type) {
    return new Promise((resolve, reject) => {
        let dataArr = [];
        let promises = [];

        for (let i = 0; i < movies.length; i++) {
            const movie = movies[i];

            if (movie.ids && movie.ids.imdb) {
                const imdbId = formatImdbId(movie.ids.imdb);
                const url = `https://api.themoviedb.org/3/movie/${imdbId}/${type}?api_key=${apiKeyTmdb}`;
                const delay = 400 * i; // TMDB has 30 request per 10 seconds

                const request = fn(url, imdbId, delay)
                    .then(data => {
                        if (data) {
                            dataArr.push(data);
                        }
                    })
                    .catch(error => reject(error));
                promises.push(request);
            }
        }

        Promise.all(promises)
            .then(() => resolve(dataArr))
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
                .then(data => {
                    if (data.status_code && data.status_code === 34 && !data.results) { // Status code for resource not be found.
                        return resolve();
                    }

                    const trailersObj = createTrailerObject(imdbId, data.results);
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
 * Gets images from TMDB service by specific imdbID
 * @param {String} url - url
 * @param {String} imdbId - IMDB id
 * @param {Int} delay - Delay in milliseconds
 * @returns {Promise} promise - Promise witch returns images object
 */
function getImagesRequest(url, imdbId, delay) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (data.status_code && data.status_code === 34 && !data.results) { // Status code for resource not be found.
                        return resolve();
                    }

                    const imagesObj = createImagesObject(imdbId, data);
                    return resolve(imagesObj);
                }).catch(error => reject(error));
        }, delay);
    });
}

/**
 * Creates new images object from TMDB images object
 * @param {String} imdbId - Imdb id
 * @param {Object} images - Images object
 * @returns {Object} imagesObj - newly created images object
 */
function createImagesObject(imdbId, images) {
    let imagesObj = {
        imdb: imdbId,
        backdrops: [],
        posters: []
    };

    const sizes = [300, 500, 1000, 1920];

    if (images.backdrops && images.backdrops.length > 0) {
        _.forEach(images.backdrops, (backdrop) => {
            let urlSizes = [];

            _.forEach(sizes, (size) => {
                urlSizes.push(`http://image.tmdb.org/t/p/w${size}${backdrop.file_path}`);
            });

            imagesObj.backdrops.push(urlSizes);
        });
    }

    if (images.posters && images.posters.length > 0) {
        _.forEach(images.posters, (poster) => {
            let urlSizes = [];

            _.forEach(sizes, (size) => {
                urlSizes.push(`http://image.tmdb.org/t/p/w${size}${poster.file_path}`);
            });

            imagesObj.posters.push(urlSizes);
        });
    }

    return imagesObj;
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