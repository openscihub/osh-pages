var Path = require('osh-path');
var latency = require('./latency');

module.exports = {
  path: Path({
    pattern: '/interrupt'
  }),

  get: function(done) {
    this.title = 'Interrupt test';
    done();
  },

  /**
   *  Here's the test.
   */
  run: function() {
    console.log('running /interrupt ui...');
    var err;
    var pages = this.pages;
    pages.get('user', {username: 'adam'},
      function(_err) {
        err = _err;
      }
    );
    setTimeout(
      function() {
        pages.get('user', {username: 'tory'},
          function(_err) {
            document.location = (
              err ?
              '/?result=Success' :
              '/?result=Failure: no interruption'
            );
          }
        );
      },
      latency / 2
    );
  }
};
