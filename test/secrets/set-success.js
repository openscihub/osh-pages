module.exports = {
  setIt: function(pages, done) {
    // Try to set the secret. Should fail.
    pages.session.setSecrets({secret: 'sshh'});
    done();
  },

  read: function(pages, render) {
    // Try to set the secret. Should fail.
    pages.session.setState({nosecret: 'helloworld'});
    this.privately('setIt', function(err) {
      render();
    });
  }
};
