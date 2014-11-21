var latency = require('./latency');

var RunPage = {
  read: function(pages, render) {
    render();
  },

  renderToString: function() {
    return (
      '<!DOCTYPE html>' +
      '<body>' +
        this.renderAjax() +
      '</body>' +
      '</html>'
    );
  },

  /**
   *  Here's the test.
   */
  run: function(pages) {
    pages.go('user', {username: 'adam'});
    setTimeout(
      function() {
        pages.go('user', {username: 'tory'});
      },
      latency / 2
    );
  }
};

module.exports = RunPage;
