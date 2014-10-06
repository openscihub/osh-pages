var Pages = require('..');
var express = require('express');
var expect = require('expect.js');
var supertest = require('supertest');
var async = require('async');

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
        expect(entryInfo.user.length).to.be(4);
        expect(entryInfo.article.length).to.be(4);
        done();
      });
    });

    it.only('should serve', function(done) {
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
        expect(entryInfo.user.length).to.be(4);
        expect(entryInfo.article.length).to.be(4);

        var request = supertest(pages.app);
        request.get('/users/tory')
        .expect(200, /whatever/, done);
      });
    });
  });
});
