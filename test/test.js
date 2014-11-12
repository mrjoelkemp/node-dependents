var dependents = require('../'),
    assert = require('assert');

describe('dependents', function() {
  it('returns the (non-aliased) modules that depend on the given module', function(done) {
    dependents.for({
      filename: __dirname + '/example/amd/b.js',
      directory: __dirname + '/example/amd',
      success: function(dependents) {
        assert(dependents.length === 1);
        assert(dependents[0].indexOf('a.js') !== -1);
        done();
      }
    });
  });

  it('properly resolves aliased modules if given a requirejs config', function(done) {
    dependents.for({
      filename: __dirname + '/example/amd/b.js',
      directory: __dirname + '/example/amd',
      config: __dirname + '/example/amd/config.json',
      success: function(dependents) {
        assert(dependents.length === 2);
        assert(dependents[0].indexOf('a.js') !== -1);
        assert(dependents[1].indexOf('c.js') !== -1);
        done();
      }
    });
  });

  it('does not throw on esprima errors', function(done) {
    dependents.for({
      filename: __dirname + '/example/error.js',
      directory: __dirname + '/example',
      success: function(dependents) {
        assert(!dependents.length);
        done();
      }
    });
  });

  it('finds the dependents of commonjs modules', function (done) {
    dependents.for({
      filename: __dirname + '/example/commonjs/b.js',
      directory: __dirname + '/example/commonjs',
      success: function (dependents) {
        assert(dependents.length);
        done();
      }
    })
  });

  it('finds the dependents of es6 modules', function (done) {
    dependents.for({
      filename: __dirname + '/example/es6/b.js',
      directory: __dirname + '/example/es6',
      success: function (dependents) {
        assert(dependents.length);
        done();
      }
    })
  });
});
