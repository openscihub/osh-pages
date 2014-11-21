var iso = require('osh-iso-test');

var RunPrivately = {
  getAccessToken: function(pages, done) {
    try {
      pages.session.setState({accessToken: 'deadbeef'});
      pages.session.setSecrets({refreshToken: 'badf00d'});
      done();
    }
    catch (err) {
      done(err);
    }
  },

  refreshAccessToken: function(pages, done) {
    if (pages.session.secrets.refreshToken !== 'badf00d') {
      done(new Error('bad secret'));
    }
    else {
      pages.session.setState({accessToken: 'deadbeef2'});
      done();
    }
  },

  read: function(pages, render) {
    if (this.props.refresh) {
      this.privately('refreshAccessToken', function(err) {
        if (err) iso.fail(err.message);
        else if (pages.session.state.accessToken !== 'deadbeef2') {
          iso.fail('access token not updated');
        }
        else iso.ok('A-ok');
      });
    }
    else {
      this.privately('getAccessToken', function(err) {
        if (err) iso.fail(err.message);
        else if (pages.session.state.accessToken !== 'deadbeef') {
          iso.fail('access token not set');
        }
        else render();
      });
    }
  },

  renderToString: function(pages) {
    return (
      '<script>document.location = "/?refresh=true";</script>'
    );
  }
};

module.exports = RunPrivately;
