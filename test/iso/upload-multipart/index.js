var Pages = require('../../..');

module.exports = function(app, done) {
  var pages = Pages({basedir: __dirname});

  pages.routes('./routes');
  pages.set('run', './run');

  app.use(pages);
  done();
};
