var serveStatic = require('serve-static');
var Pages = require('../../..');

module.exports = function(app, done) {
  var pages = Pages({
    basedir: __dirname,
    routes: './routes'
  });

  pages.set('run', './run');
  pages.set('user', './user');

  pages.bundle({
    output: __dirname + '/bundles',
    prefix: '/'
  });
  pages.once('error', function(err) {
    console.log(err);
    done(err);
  });
  pages.on('bundled', function() {
    done();
  });

  app.use(serveStatic(__dirname + '/bundles'));
  app.use(pages);
};
