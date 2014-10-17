var serveStatic = require('serve-static');

module.exports = function(pages) {
  pages.add({
    run: __dirname + '/run-page',
    user: __dirname + '/user-page'
  });

  pages.get('run', function(req, res) {res.page.send();});
  pages.get('user', function(req, res) {res.page.send();});

  pages.bundle({
    output: __dirname + '/bundles',
    prefix: '/interrupt/'
  });

  pages.app.use(
    '/interrupt',
    serveStatic(__dirname + '/bundles')
  );
};
