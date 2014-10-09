var Path = require('osh-path');
var api = require('./api');

module.exports = {
  path: Path({
    pattern: '/' + __dirname + '/users/<username>',
    params: {user: /^\w+$/},
    query: {age: /^[0-9]+$/}
  }),

  get: function(done) {
    var page = this;

    page.title = 'User page';
    api.getUser(page.props.username, function(err, user) {
      page.user = user;
      page.body = (
        '<h1 id="name">' + user.name + '</h1>';
      );
      done();
    });
  }
};
