var serveStatic = require('serve-static');

module.exports = function(pages) {
  pages.add({
    run: require.resolve('./run-page')
    //redirector: require.resolve('../sample-pages/redirector')
  });

  pages.get('run', function(req, res) {res.page.send();});
  //pages.get('redirector', function(req, res) {res.page.send();});

  pages.bundle({
    output: __dirname + '/bundles',
    prefix: '/redirector/'
  });

  pages.app.use(
    '/redirector',
    serveStatic(__dirname + '/bundles')
  );
};
