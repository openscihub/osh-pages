var Pages = require('..');
var express = require('express');
var expect = require('expect.js');
var supertest = require('supertest');
var async = require('async');
var morgan = require('morgan');
var http = require('http');
var host = require('osh-test-host');

describe('pages', function() {
  describe('server', function() {
    it('should bundle', function(done) {
      this.timeout(10.e3);
      var pages = Pages();
      pages.add('user', require.resolve('./sample-pages/user'));
      pages.add('article', require.resolve('./sample-pages/article'));
      pages.bundle({output: __dirname + '/bundles'});
      pages.on('bundled', function(entryInfo) {
        //console.log(JSON.stringify(entryInfo, null, 2));
        expect(entryInfo.user.length).to.be(5);
        expect(entryInfo.article.length).to.be(5);
        done();
      });
    });

    it('should serve', function(done) {
      var pages = Pages(); // creates express app
      pages.add('user', require.resolve('./sample-pages/user'));
      pages.add('article', require.resolve('./sample-pages/article'));

      pages.get('user', function(req, res) {
        var username = res.page.props.username;
        res.page.setProps({upper: username.toUpperCase()});
        res.page.send();
      });

      pages.bundle({output: __dirname + '/bundles'});
      pages.on('bundled', function(entryInfo) {
        //console.log(JSON.stringify(entryInfo, null, 2));
        expect(entryInfo.user.length).to.be(5);
        expect(entryInfo.article.length).to.be(5);

        var request = supertest(pages.app);
        request.get('/users/tory')
        .expect(200, /hi user: tory/, done);
      });
    });

    it('should redirect', function(done) {
      var pages = Pages();
      pages.add('redirector', require.resolve('./sample-pages/redirector'));
      pages.get('redirector', function(req, res) {
        res.page.send();
      });
      pages.bundle({output: __dirname + '/bundles'});
      pages.on('bundled', function() {

        supertest(pages.app)
        .get('/redirector')
        .redirects(0)
        .expect(302, done);
      });
    });
  });

  describe('browser', function() {

    //  Each name is a subdirectory of the test directory
    //  that contains an index.js file that exports a
    //  name/page-path mapping.
    //
    //  The mapping should have a homepage that runs a test
    //  when the 
    var tests = [
      'interrupt',
      'redirector',
      'stash'
      //'visit',
    ];

    var runner = express();
    runner.use(morgan('combined'));

    before(function(done) {

      async.each(
        tests,
        function(test, done) {
          var pages = Pages();
          var dir = __dirname + '/' + test;
          var init = require(dir);
          init(pages); 
          pages.on('bundled', function() {
            runner.use(pages.app);
            done();
          });
        },
        done
      );
    });

    before(function(done) {
      var i = -1;
      var results = [];
      runner.get('/', function(req, res) {
        var result = req.query.result;
        var nextTest;
        if (result) {
          nextTest = tests[++i];
          results.push(result);
        }
        else {
          i = 0;
          nextTest = tests[i];
          results = [];
        }
        res.send(
          '<html><body>' +
          '<ul>' +
          results.map(function(result, index) {
            return '<li>' + tests[index] + ': ' + result + '</li>';
          }).join('') +
          '</ul>' +
          (
            nextTest ?
            '<script>document.location = "/' + nextTest + '";</script>' :
            ''
          ) +
          '</body></html>'
        );
      });

      server = http.createServer(runner);
      server.listen(host.port, done);
    });

    /**
     *  Test stuff.
     */

    it('should complete browser tests', function(done) {
      this.timeout(0);
      console.log('Browser to http://localhost:3333. Ctrl-C to finish.');
      process.on('SIGINT', function() {
        console.log('Stopping server...');
        server && server.close();
        process.exit();
      });
    });
  });
});
