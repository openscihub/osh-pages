module.exports = {
  read: function(pages, render) {render()},

  renderToString: function(pages) {
    return pages.csrf.name + '=' + pages.csrf.value;
  }
};
