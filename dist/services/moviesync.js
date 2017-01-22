'use strict';

var fetch = require('node-fetch');
var _ = require('lodash');

var _require = require('./utils'),
    deepTrim = _require.deepTrim;

var genres = require('../data/genres');
var apiKeyKvikmyndir = process.env.API_KEY_KVIKMYNDIR;
var apiKeyTmdb = process.env.API_KEY_TMDB;
var mlabDevUrl = process.env.MLAB_DEV_URL;

var MongoClient = require('mongodb').MongoClient;

module.exports = function (callback) {
    // Contains all movies for 5 days in one big array [movie1, movie2, movie2, ...]
    var allMovies = [];
    // Contains all movies for 5 days [[day0]], [day1]], [day2]], ...]
    var moviesByDay = [];
    // allMovies array merged into uniqe movie array
    var mergedList = [];
    // Contains upcoming movies { ... ,data: [movie1, movie2, movie2, ...] }
    var upcomingMovies = {
        date: null,
        type: 'upcoming',
        data: []
    };
    // Array of movie plots object [{imdb:'tt0317248',text: 'This is movie plot text'}, ...]
    var plotsArr = [];
    // Array of trailer information for movie [{imdb:'tt0317248',data: [{...}, {...}, ...]]
    var trailersArr = [];
    // Array of omdb information for movie [{imdb:'tt0317248',data: {...}, ...]
    var omdbArr = [];
    // Array of images objects [{imdb:'tt0317248',data: {...}, ...]
    var imagesArr = [];

    getKvikmyndir().then(function (data) {
        moviesByDay = data;
        allMovies = mergeMovieArrays(data);
        mergedList = _.uniqBy(allMovies, 'id'); // Find uniqe movies by id in array, 

        return getUpcoming();
    }).then(function (data) {
        upcomingMovies.date = Date.now();
        upcomingMovies.data = data;
        mergedList = _.unionBy(mergedList, data, 'id');

        return getPlotForMovies(mergedList); // Get plot for each movie in array
    }).then(function (plots) {
        plotsArr = plots;

        return getTmdbData(mergedList, getTrailersRequest, 'videos'); // Get trailers for each movie in array
    }).then(function (trailersData) {
        trailersArr = trailersData;

        return getTmdbData(mergedList, getImagesRequest, 'images'); // Get trailers for each movie in array
    }).then(function (imagesData) {
        imagesArr = imagesData;

        return getOmdbData(mergedList); // Get omdb information for each movie in array
    }).then(function (omdbData) {
        omdbArr = omdbData;

        var propsToDelete = ['directors_abridged', 'actors_abridged', 'alternativeTitles', 'alternative_titles', 'ids', 'id', 'certificateImg', 'certificateIS', 'ratings'];

        moviesByDay.forEach(function (day) {
            day.data = extendMoviesObjects(day.data, plotsArr, trailersArr, imagesArr, omdbArr, propsToDelete);
        });

        upcomingMovies.data = extendMoviesObjects(upcomingMovies.data, plotsArr, trailersArr, imagesArr, omdbArr, propsToDelete);

        MongoClient.connect(mlabDevUrl, function (err, db) {
            insertDocument(db, moviesByDay[0].data, function () {
                db.close();
            });
        });
    }).catch(function (error) {
        return console.error(error);
    });
};

function insertDocument(db, documents, callback) {
    db.collection('movies').insert(documents, function (err, result) {
        console.log("Inserted a document into the movies collection.");
        callback();
    });
};

/**
 * Extends movie objects with plots, trailers, images and omdb objects
 * also refactors movie objects from kvikmyndir.is
 * @param {Array} movies - Array of movie objects
 * @param {Array} plots - Array of plot objects
 * @param {Array} trailers - Array of trailers objects
 * @param {Array} images - Array of images objects
 * @param {Array} omdb - Array of omdb objects
 * @returns {Array} movies - Array of extended movie objects
 */
function extendMoviesObjects(movies, plots, trailers, images, omdb, propsToDelete) {
    movies.forEach(function (movie) {
        var imdbId = formatImdbId(movie.ids.imdb);

        // Create kvikmyndir object
        movie.kvikmyndir = {
            id: movie.id ? movie.id : '',
            url: movie.id ? 'http://kvikmyndir.is/mynd/?id=' + movie.id : ''
        };

        // Create rated object
        movie.rated = {
            is: movie.certificateIS ? movie.certificateIS : '',
            en: ''
        };

        // IMDB
        movie.imdb = {
            id: imdbId,
            rating: movie && movie.ratings && movie.ratings.imdb,
            url: 'http://www.imdb.com/title/' + imdbId + '/',
            votes: ''
        };

        // OMDB
        if (omdb && omdb.length > 0) {
            var omdbObj = _.find(omdb, function (o) {
                return o.imdb === imdbId;
            });
            var omdbProps = ['Country', 'Awards', 'Website'];

            if (omdbObj && omdbObj.data) {
                // Create Rotten Tomatos object
                movie.rottenTomatoes = {};

                for (var key in omdbObj.data) {
                    // Check if property is not inherited from prototype
                    if (omdbObj.data.hasOwnProperty(key)) {
                        // Add all tomato keys to rottenTomatoes object
                        if (key.includes('tomato')) {
                            movie.rottenTomatoes[key] = omdbObj.data[key] !== 'N/A' ? omdbObj.data[key] : '';
                        }

                        // Add keys in omdbProps array to movie object
                        for (var i = 0; i < omdbProps.length; i++) {
                            if (omdbProps[i] === key) {
                                movie[omdbProps[i].toLowerCase()] = omdbObj.data[key] !== 'N/A' ? omdbObj.data[key] : '';
                            }
                        }

                        // Rated
                        var rated = omdbObj.data.Rated;
                        if (rated && rated !== 'N/A') {
                            movie.rated.en = rated;
                        }

                        // IMDB rating
                        var rating = omdbObj.data.imdbRating;
                        if (rating && rating !== 'N/A') {
                            movie.imdb.rating = rating;
                        }

                        // IMDB votes
                        var votes = omdbObj.data.imdbVotes;
                        if (votes && votes !== 'N/A') {
                            movie.imdb.votes = votes;
                        }
                    }
                }

                // If not tomatoRating
                if (movie.rottenTomatoes.tomatoRating === '' && movie.ids && movie.ids.rotten !== '') {
                    movie.rottenTomatoes.tomatoRating = movie.ids.rotten;
                }
            }
        }

        // GENRES
        if (movie.genres) {
            (function () {
                var tempGenres = {
                    is: [],
                    en: []
                };

                _.forEach(movie.genres, function (genreId) {
                    var genreObj = _.find(genres, function (o) {
                        return o.ID === genreId;
                    });
                    tempGenres.is.push(genreObj.Name);
                    tempGenres.en.push(genreObj.NameEN);
                });

                movie.genres = tempGenres;
            })();
        }

        // PLOTS
        if (plots && plots.length > 0) {
            var matchedPlot = _.find(plots, function (p) {
                return p.imdb === imdbId;
            });
            movie.plot = {
                is: matchedPlot && matchedPlot.text ? matchedPlot.text : '',
                en: omdb && omdb.data && omdb.data.Plot ? omdb.data.Plot : ''
            };
        }

        // TRAILERS
        if (trailers && trailers.length > 0) {
            var matchedTrailer = _.find(trailers, function (trailer) {
                return trailer.imdb === imdbId;
            });
            if (matchedTrailer && matchedTrailer.data) movie.trailers = matchedTrailer.data;
        }

        // IMAGES
        if (images && images.length > 0) {
            var matchedImages = _.find(images, function (image) {
                return image.imdb === imdbId;
            });

            if (matchedImages && matchedImages.backdrops && matchedImages.posters) {
                movie.images = {
                    backdrops: matchedImages.backdrops,
                    posters: matchedImages.posters
                };
            }
        }

        // ACTORS
        if (movie.actors_abridged && movie.actors_abridged.length > 0) {
            var getActorName = function getActorName(d) {
                return d.name;
            };
            movie.actors = movie.actors_abridged.map(getActorName);
        }

        // DIRECTORS
        if (movie.directors_abridged && movie.directors_abridged.length > 0) {
            var getDirectorName = function getDirectorName(d) {
                return d.name;
            };
            movie.directors = movie.directors_abridged.map(getDirectorName);
        }

        // DELETE props from object
        var deleteItem = function deleteItem(item) {
            if (movie[item]) delete movie[item];
        };

        propsToDelete.map(deleteItem);

        // Deep trims every property and its children
        movie = deepTrim(movie);
    });

    return movies;
}

/**
 * Makes get request to Kvikmyndir.is API to get movie showtimes
 * @returns {Promise} Promise - the promise object
 */
function getKvikmyndir() {
    return new Promise(function (resolve, reject) {
        var movieArr = []; // Contains all movies for 5 days [[day0]], [day1]], [day2]], ...]
        var promises = [];

        var _loop = function _loop(i) {
            var url = 'http://kvikmyndir.is/api/showtimes_by_date/?key=' + apiKeyKvikmyndir + '&dagur=' + i;

            var request = fetch(url).then(function (res) {
                return res.json();
            }).then(function (data) {
                movieArr.push({
                    day: i,
                    date: Date.now(),
                    type: 'showtimes',
                    data: data
                });
            }).catch(function (error) {
                return reject(error);
            });

            promises.push(request);
        };

        for (var i = 0; i < 5; i++) {
            _loop(i);
        }

        Promise.all(promises).then(function () {
            return resolve(movieArr);
        }).catch(function (error) {
            return reject(error);
        });
    });
}

/**
 * Makes get request to Kvikmyndir.is API to get upcoming movies
 * @returns {Promise} Promise - the promise object
 */
function getUpcoming() {
    return new Promise(function (resolve, reject) {
        var url = 'http://kvikmyndir.is/api/movie_list_upcoming/?key=' + apiKeyKvikmyndir + '&count=100';

        fetch(url).then(function (res) {
            return res.json();
        }).then(function (data) {
            return resolve(data);
        }).catch(function (error) {
            return reject(error);
        });
    });
}

/**
 * Makes get request to Kvikmyndir.is API and gets additonal information about movie
 * Specifically gets plot for movie
 * @param {Array} movies - Array of movie objects
 * @returns {Promise} Promise - the promise object
 */
function getPlotForMovies(movies) {
    return new Promise(function (resolve, reject) {
        var moviesWithPlot = [];
        var promises = [];

        movies.forEach(function (movie) {
            if (movie.ids && movie.ids.imdb) {
                var url = 'http://kvikmyndir.is/api/movie/?imdb=' + movie.ids.imdb + '&key=' + apiKeyKvikmyndir;
                var request = fetch(url).then(function (res) {
                    return res.json();
                }).then(function (data) {
                    if (data.plot && data.imdb) {
                        moviesWithPlot.push({
                            imdb: formatImdbId(data.imdb),
                            text: data.plot
                        });
                    }
                }).catch(function (error) {
                    return reject(error);
                });

                promises.push(request);
            }
        });

        Promise.all(promises).then(function () {
            return resolve(moviesWithPlot);
        }).catch(function (error) {
            return reject(error);
        });
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
    return new Promise(function (resolve, reject) {
        var dataArr = [];
        var promises = [];

        for (var i = 0, len = movies.length; i < len; i++) {
            var movie = movies[i];

            if (movie.ids && movie.ids.imdb) {
                var imdbId = formatImdbId(movie.ids.imdb);
                var url = 'https://api.themoviedb.org/3/movie/' + imdbId + '/' + type + '?api_key=' + apiKeyTmdb;
                var delay = 400 * i; // TMDB has 30 request per 10 seconds

                var request = fn(url, imdbId, delay).then(function (data) {
                    if (data) {
                        dataArr.push(data);
                    }
                }).catch(function (error) {
                    return reject(error);
                });
                promises.push(request);
            }
        }

        Promise.all(promises).then(function () {
            return resolve(dataArr);
        }).catch(function (error) {
            return reject(error);
        });
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
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            fetch(url).then(function (res) {
                return res.json();
            }).then(function (data) {
                if (data.status_code && data.status_code === 34 && !data.results) {
                    // Status code for resource not be found.
                    return resolve();
                }

                var trailersObj = createTrailerObject(imdbId, data.results);
                return resolve(trailersObj);
            }).catch(function (error) {
                return reject(error);
            });
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
    var trailersObj = {
        imdb: imdbId,
        data: []
    };

    var trailer = function trailer(t) {
        return {
            id: t.id,
            url: 'https://www.youtube.com/embed/' + t.key + '?rel=0',
            size: t.size,
            name: t.name
        };
    };

    trailersObj.data = trailers.map(trailer);

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
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            fetch(url).then(function (res) {
                return res.json();
            }).then(function (data) {
                if (data.status_code && data.status_code === 34 && !data.results) {
                    // Status code for resource not be found.
                    return resolve();
                }

                var imagesObj = createImagesObject(imdbId, data);
                return resolve(imagesObj);
            }).catch(function (error) {
                return reject(error);
            });
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
    var imagesObj = {
        imdb: imdbId,
        backdrops: [],
        posters: []
    };

    var sizes = [300, 1920]; // also avaliable 500 and 1000

    if (images.backdrops && images.backdrops.length > 0) {
        imagesObj.backdrops = sizes.map(function (size) {
            return images.backdrops.map(function (backdrop) {
                return 'http://image.tmdb.org/t/p/w' + size + backdrop.file_path;
            });
        });
    }

    if (images.posters && images.posters.length > 0) {
        imagesObj.posters = sizes.map(function (size) {
            return images.posters.map(function (poster) {
                return 'http://image.tmdb.org/t/p/w' + size + poster.file_path;
            });
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
    return new Promise(function (resolve, reject) {
        var omdbArr = []; // Contains all trailers object
        var promises = [];

        for (var i = 0; i < movies.length; i++) {
            var movie = movies[i];

            if (movie.ids && movie.ids.imdb) {
                var imdbId = formatImdbId(movie.ids.imdb);
                var url = 'http://www.omdbapi.com/?i=' + imdbId + '&plot=true&tomatoes=true&r=json';

                var request = fetch(url).then(function (res) {
                    return res.json();
                }).then(function (data) {
                    omdbArr.push({
                        imdb: data.imdbID,
                        data: data
                    });
                }).catch(function (error) {
                    return reject(error);
                });

                promises.push(request);
            }
        }

        Promise.all(promises).then(function () {
            return resolve(omdbArr);
        }).catch(function (error) {
            return reject(error);
        });
    });
}

/**
 * Iterates array of arrays, and puts those object into new array
 * @param {Array} array
 * @returns {Array} newArray
 */
function mergeMovieArrays(array) {
    var newArray = [];

    // Push each movie into array
    for (var i = 0; i < array.length; i++) {
        for (var j = 0; j < array[i].data.length; j++) {
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
    return imdbId.indexOf('tt') > -1 ? imdbId : 'tt' + imdbId;
}