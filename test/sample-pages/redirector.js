var Path = require('osh-path');

module.exports = {
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
};
