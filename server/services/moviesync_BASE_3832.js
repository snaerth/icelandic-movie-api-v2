const fetch = require('node-fetch');
const _ = require('lodash');
const apiKey = process.env.API_KEY_KVIKMYNDIR;

module.exports = (callback) => {
    let cnt = 0;
    let allMovies = []; // Contains all movies for 5 days in one big array [movie1, movie2, movie2, ...]
    let moviesByDay = []; // Contains all movies for 5 days [[day0]], [day1]], [day2]], ...]

    for (let i = 0; i < 5; i++) {
        const url = `http://kvikmyndir.is/api/showtimes_by_date/?key=${apiKey}&dagur=${i}`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                moviesByDay.push(data);

                // Push each movie into array
                for (let i = 0; i < data.length; i++) {
                    allMovies.push(data[i]);
                }

                cnt++;

                // When all days have finished
                // Find uniqe movies in allMovies array, 
                // and get plot for each of those movies
                if (cnt === 5) {
                    let mergedList = _.uniqBy(allMovies, 'id');
                    getPlotForMovies(mergedList)
                        .then(plots => {
                            addPlotToMovies(moviesByDay, plots);
                        })
                        .catch(error => console.error(error));
                }
            })
            .catch(err => console.error(err));
    }
}

// Makes get request to Kvikmyndir.is API and gets additonal information about movie
// Specifically gets plot for movie
// @param {Array} movies - Array of movie objects
// @param {Function} callback - Callback function
// @returns {Promise} Promise - the promise object
function getPlotForMovies(movies, callback) {
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
    for(let i = 0; i < movies.length;i++) {
        for(let j = 0; j < movies[i].length;j++) {
            let movie = movies[i][j];
            if(movie.ids && movie.ids.imdb) {
                for(let k = 0; k < plots.length;k++) {
                    if(plots[k].imdb === movie.ids.imdb) {
                        movie.plot = plots[k].plot;
                    }
                }
            }
        }
    }

    return movies;
}