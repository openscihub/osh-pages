module.exports = {
  read: function(pages, render) {
    if (this.props.stay) {
      this.setState({body: 'Great success'});
      render();
    }
    else {
      render(this.name, {stay: false});
    }
  }
};
