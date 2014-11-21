var RunPrivately = require('../privately/run');
var extend = require('xtend/mutable');

var RunPrivatelyAjax = extend(RunPrivately, {
  renderToString: function(pages) {
    return this.renderAjax();
  },

  run: function(pages) {
    pages.go('/?refresh=true');
  }
});

module.exports = RunPrivatelyAjax;
