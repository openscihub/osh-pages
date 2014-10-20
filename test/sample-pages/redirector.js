var Path = require('osh-path');
var Page = require('osh-page');

module.exports = Page.extend({
  path: Path({
    pattern: '/redirector',
    query: {stay: /[^\/]+/}
  }),

  get: function(done) {
    if (this.props.stay) {
      this.body = 'Great success';
    }
    else {
      this.redirect(this.name, {stay: false});
    }
    done();
  }
});
