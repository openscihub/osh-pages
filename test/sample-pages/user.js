var Path = require('osh-path');

module.exports = {
  path: Path({
    pattern: '/users/<username>',
    params: {
      username: /^\w+$/
    },
    query: {
      age: /^[0-9]+$/
    }
  }),

  get: function(done) {
    this.title = this.props.username;
    this.body = 'hi user: ' + this.props.username;
    done();
  }
};
