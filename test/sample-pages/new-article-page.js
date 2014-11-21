
var NewArticlePage = {
  readAndWrite: function(session, done) {
    var form = this.pages.form('post-article');
    this.setState({
      body: (
        '<form id="my-form" action="' + form.action + '" method="' + form.method + '">' +
          '<input type="hidden" name="_csrf" value="' + form.csrfToken + '"></input>' +
          '<input type="file"'
        '</form>'
      )
    });
  },

  renderToDocument: function(prevPage) {
    React.renderComponent()
    done();

  },

  recoverState: function() {
    this.setState({

    });
  },

  run: function() {
    if (this.initialLoad) {

    }

    var pages = this.pages;
    pages.ajax(
      document.getElementById('my-form'),
      document.getElementById('my-link')
    );

    pages.click('my-link');
    pages.submit('my-form');
  }
};

var Body = React.createClass({

  render: function() {
    var form = this.props.pages;
    return div(
      form({
          action: pages.uri('post-article'),
          method: 'POST',
          onSubmit: pages.submit.bind(pages, 'post-article')
        },
        input({name: 'title', type: 'text'}),
        input({name: 'pdf', type: 'file'})
      )

    );

  }

});

module.exports = NewArticlePage;
