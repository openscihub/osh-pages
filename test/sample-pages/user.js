module.exports = {
  read: function(pages, render) {
    this.setState({
      title: this.props.username,
      body: 'hi user: ' + this.props.username
    });
    render();
  }
};
