var util = require('../lib/util');
var dependents = require('../');
var getJSFiles = require('get-all-js-files');

var fork = require('child_process').fork

var q = require('q');
var dir = require('node-dir');
var path = require('path');
var ConfigFile = require('requirejs-config-file').ConfigFile;

/**
 * Uniquely aggregates the dependents across forks (if used).
 * This being an object allows us to avoid duplicate dependents.
 *
 * @type {Object}
 */
var _dependents = {};

/**
 * Minimum Number of files needed to require clustering
 *
 * @type {Number}
 */
var threshold = 500;

/**
 * The approximate number of times a worker should come back for more files to process.
 * Empirically set.
 * @type {Number}
 */
var numTripsPerWorker = 5;

var directory;
var exclude;
var filename;
var config;

module.exports = function(options) {
  directory = options.directory;
  exclude = options.exclude;
  filename = options.filename;
  config = options.config;

  if (exclude && typeof exclude === 'string') {
    exclude = exclude.split(',');
  }

  exclude = util.DEFAULT_EXCLUDE_DIR.concat(exclude);
  var exclusions = util.processExcludes(exclude, directory);

  // Convert once and reuse across processes
  if (config && typeof config !== 'object') {
    config = new ConfigFile(config).read();
  }

  // TODO: Reduce this duplication with index.js
  if (util.isSassFile(filename)) {
    util.getFiles(['.scss', '.sass'], {
      directory: directory,
      filesCb: filesCb
    });

  } else if (util.isStylusFile(filename)) {
    util.getFiles(['.styl'], {
      directory: directory,
      filesCb: filesCb
    });
  } else {
    getJSFiles({
      directory: directory,
      dirOptions: {
        excludeDir: exclusions.directories,
        exclude: exclusions.files
      },
      filesCb: filesCb
    });
  }
};

/**
 * Called when all JS files have been fetched
 * @param  {String[]} files
 */
function filesCb(files) {
  if (files.length >= threshold) {
    spawnWorkers(filename, files, printDependents);

  } else {
    dependents({
      filename: filename,
      directory: directory,
      files: files,
      config: config,
      exclusions: exclude,
      success: printDependents
    });
  }
}

/**
 * Forks separate node processes to find dependents for the filename in parallel
 *
 * @param  {String}   filename  - File to find the dependents for
 * @param  {Array}    files     - List of JS files to process
 * @param  {Function} cb        - Executed with String[] of dependent filenames
 */
function spawnWorkers(filename, files, cb) {
  var numCPUs = require('os').cpus().length;
  var numFiles = files.length;
  // We don't care to overshoot the number of files, slice will correct this
  var chunkSize = Math.ceil(numFiles / numCPUs / numTripsPerWorker);
  var numFilesProcessed = 0;
  var workers = [];

  for (var i = 0; i < numCPUs; i++) {
    workers.push(fork(__dirname + '/worker.js'));
  }

  q.all(workers.map(function(worker) {
    var deferred = q.defer();
    var delegateWork = function(worker) {
      var _files = getMoreFiles(files, chunkSize);

      if (!_files.length) {
        deferred.resolve();
        worker.kill();
        return;
      }

      worker.send({
        filename: filename,
        directory: directory,
        files: _files,
        config: config,
        exclusions: exclude
      });

      numFilesProcessed += _files.length;
    };

    delegateWork(worker);

    worker.on('message', function(data) {
      if (data.err) { throw data.err; }

      data.deps.forEach(function(depFilename) {
        _dependents[depFilename] = 1;
      });

      delegateWork(worker);
    });

    return deferred.promise;
  }))
  .catch(cb)
  .done(function() {
    if (numFilesProcessed !== numFiles) {
      cb(new Error('failed to process some files'));
      return;
    }

    cb(null, Object.keys(_dependents));
  });
}

/**
 * @param  {String[]} files
 * @param  {Number} chunkSize
 * @return {String[]}
 */
function getMoreFiles(files, chunkSize) {
  if (typeof getMoreFiles.tripNum === 'undefined') {
    getMoreFiles.tripNum = 0;
  }

  var start = getMoreFiles.tripNum * chunkSize;
  var end = (getMoreFiles.tripNum + 1) * chunkSize;
  var _files = files.slice(start, end);

  getMoreFiles.tripNum++;

  return _files;
}

/**
 * @param {Object} err
 * @param {String[]} dependents
 */
function printDependents(err, dependents) {
  dependents.forEach(function(dependent) {
    console.log(dependent);
  });
}