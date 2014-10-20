var Path = require('osh-path');
var Page = require('osh-page');
var latency = require('./latency');

module.exports = Page.extend({
  path: {
    pattern: ('undefined' == typeof iso ? '/' : iso.route)
  },

  get: function(done) {
    this.title = 'Interrupt test';
    this.body = '';
    done();
  },

  /**
   *  Here's the test.
   */
  run: function() {
    var pages = this.pages;
    pages.get('user', {username: 'adam'});
    setTimeout(
      function() {
        pages.get('user', {username: 'tory'});
      },
      latency / 2
    );
  }
});
