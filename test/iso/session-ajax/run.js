var stem = require('osh-iso-test');

var SessionPage = {
  read: function(pages, render) {
    var session = pages.session;
    if (this.props.check) {
      if (session.state.value === 'hello-ajax') stem.ok('Session state was set');
      else stem.fail('Session state missing');
      // no done(), let stem hijack the page.
    }
    else {
      // Clear session state from previous test.
      session.setState({value: 'hello-ajax'});
      render();
    }
  },

  renderToString: function() {
    return (
      '<body>' + this.renderAjax() + '</body>'
    );
  },

  run: function(pages) {
    // AJAX nav
    pages.go('/?check=true');
  }
};

module.exports = SessionPage;
