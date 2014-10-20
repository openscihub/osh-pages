var Path = require('osh-path');
var Page = require('osh-page');
var api = require('./api');

var routeBase = ('undefined' == typeof iso ? '' : iso.route);

module.exports = Page.extend({
  path: {
    pattern: routeBase + '/users/<username>',
    params: {username: /^\w+$/},
    query: {age: /^[0-9]+$/}
  },

  get: function(done) {
    var page = this;

    page.title = 'User page';
    api.getUser(page.props.username, function(err, user) {
      page.user = user;
      page.body = (
        '<h1 id="name">' + user.name + '</h1>'
      );
      done();
    });
  },

  post: function(done) {
    api.newUser(this.user, function(err, user) {
    });
  },

  run: function() {
    // When we run, we better be tory, not adam. Because tory
    // interrupts adam.
    if (this.props.username === 'tory') iso.ok('tory interrupted adam');
    else iso.fail('tory should have interrupted adam');
  }
});
