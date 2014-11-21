'use strict';

var Page = require('./page');
var extend = require('xtend/mutable');
var merge = require('xtend/immutable');
var request = require('superagent');
var csrf = require('./browser-csrf');
var CSRF_HEADER = require('./csrf-header');
var cookies = require('./browser-cookies');

/**
 *  Listen in on the creation of a Page to store the instance in a
 *  registry. We need the registry to render pages on popstate events.
 */

function BrowserPage() {
  Page.call(this);
}

extend(BrowserPage.prototype, Page.prototype, {
  
  stash: function() {
    // noop in browser.
  },

  setState: function(state) {
    extend(this.state, state);
  },

  request: function(action, args) {
    return this.pages.request(action, args);
  },

  submit: function(form) {
    this.pages.submit(form);
  },

  privately: function(fn, callback) {
    var page = this;
    var req = request.get(page.uri);
    req.query({__fn__: fn});
    req.set(CSRF_HEADER, csrf.value);
    req.end(function(res) {
      var body = res.body;
      if (res.ok) {
        page.setState(body.state);
        extend(csrf, body.csrf);
      }
      cookies.refresh();
      callback(
        body.message && new Error(body.message)
      );
    });
  },

  /**
   *  Actually renders to the DOM. Huh. Override this when
   *  you want to use a fancier renderer, like ReactJS.
   */
  
  renderToDocument: function() {
    // noop.
  },

  recoverState: function() {
    // noop
  },

  run: function() {
    // noop
  }
});

module.exports = BrowserPage;
