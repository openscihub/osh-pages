var serveStatic = require('serve-static');
var Pages = require('../../..');

module.exports = function(app, done) {
  var pages = Pages({app: app});
  var iso = this;

  pages.add({
    run: __dirname + '/run-page.js',
    user: __dirname + '/user-page.js'
  });

  pages.get('run', function(req, res) {
    res.page.scripts = iso.iso;
    res.page.send();
  });
  pages.get('user', function(req, res) {
    res.page.scripts = iso.iso;
    res.page.send();
  });

  pages.bundle({
    output: __dirname + '/bundles',
    prefix: this.route + '/'
  });

  app.use(
    serveStatic(__dirname + '/bundles')
  );

  pages.on('bundled', function() {
    done();
  });
};
