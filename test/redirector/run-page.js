var Path = require('osh-path');
var expect = require('expect.js');

var firstRun = true;

module.exports = {
  path: Path({
    pattern: '/redirector',
    query: {
      redirect: /^(true|false)$/,
      redirected: /^(true|false)$/
    }
  }),

  get: function(done) {
    if (this.props.redirect) {
      redirected = true;
      this.redirect(this.name, {redirected: true});
    }
    done();
  },

  run: function() {
    if (firstRun) {
      this.pages.get(this.name, {redirect: true});
    }
    else if (this.props.redirected) {
      document.location = '/?result=Success';
    }
    else {
      document.location = '/?result=Failure';
    }
    firstRun = false;
  }
};
