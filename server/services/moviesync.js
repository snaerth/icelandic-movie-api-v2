const fetch = require('node-fetch');
const _ = require('lodash');
const apiKey = process.env.API_KEY_KVIKMYNDIR;

module.exports = (callback) => {
    let allMovies = []; // Contains all movies for 5 days in one big array [movie1, movie2, movie2, ...]
    let moviesByDay = []; // Contains all movies for 5 days [[day0]], [day1]], [day2]], ...]

    getKvikmyndir()
        .then(data => {
            moviesByDay = data;
            allMovies = mergeMovieArrays(data);

            // Find uniqe movies by id in array, 
            let mergedList = _.uniqBy(allMovies, 'id');

            // Get plot for each movie in array
            getPlotForMovies(mergedList)
                .then(plots => {
                    var test = addPlotToMovies(moviesByDay, plots);
                    console.log(test);
                })
                .catch(error => console.error(error));
        })
        .then()
        .catch(error => {});
}

// Iterates array of arrays, and puts those object into new array
// @returns {Array} newArray
function mergeMovieArrays(array) {
    let newArray = [];

    // Push each movie into array
    for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < array[i].movies.length; j++) {
            newArray.push(array[i].movies[j]);
        }
    }

    return newArray;
}

// Makes get request to Kvikmyndir.is API to get movie showtimes
// @returns {Promise} Promise - the promise object
function getKvikmyndir() {
    return new Promise((resolve, reject) => {
        let cnt = 0;
        let arr = []; // Contains all movies for 5 days [[day0]], [day1]], [day2]], ...]

        for (let i = 0; i < 5; i++) {
            const url = `http://kvikmyndir.is/api/showtimes_by_date/?key=${apiKey}&dagur=${i}`;

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    arr.push({
                        day: i,
                        movies: data
                    });

                    cnt++;

                    // When all requests have finished, resolve promise
                    if (cnt === 5) {
                        resolve(arr);
                    }
                })
                .catch(error => reject(error));
        }
    });
}

// Makes get request to Kvikmyndir.is API and gets additonal information about movie
// Specifically gets plot for movie
// @param {Array} movies - Array of movie objects
// @returns {Promise} Promise - the promise object
function getPlotForMovies(movies) {
    return new Promise((resolve, reject) => {
        let moviesWithPlot = [];
        let promises = [];

        for (let i = 0; i < movies.length; i++) {
            const imdbId = movies[i].ids.imdb;
            const url = `http://kvikmyndir.is/api/movie/?imdb=${imdbId}&key=${apiKey}`;
            const request = fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (data.plot && data.imdb) {
                        moviesWithPlot.push({
                            imdb: data.imdb,
                            plot: data.plot
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

// Adds plot property to movies
// @param {Array} movies - Array of movie objects
// @param {Array} plots - Array of plot objects
// @returns {Array} movies - movies with plot object
function addPlotToMovies(movies, plots) {
    for (let i = 0; i < movies.length; i++) {
        for (let j = 0; j < movies[i].length; j++) {
            let movie = movies[i][j];

            if (movie.ids && movie.ids.imdb) {
                for (let k = 0; k < plots.length; k++) {
                    if (plots[k].imdb === movie.ids.imdb) {
                        movie.plot = plots[k].plot;
                    }
                }
            }
        }
    }

    return movies;
}