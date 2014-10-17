'use strict';

var BrowserPage = require('./browser-page');
var Page = require('./page');
var fetch = require('dynafetch')(require);
var merge = require('xtend/immutable');
var tick = process.nextTick;

/**
 *  Page classes fetched from js server.
 */

var _Pages = {};

/**
 *  Mapping from page name to module name that exports
 *  page prototype.
 */

var __pages = {};

var _stashElement = document.getElementById(Page.STASH_ID);

var _entry = {
  uri: _stashElement.getAttribute(Page.URI_ATTR),
  name: _stashElement.getAttribute(Page.NAME_ATTR),
  props: JSON.parse(
    _stashElement.getAttribute(Page.PROPS_ATTR)
  )
};

var _stash = {};

_stash[_entry.uri] = _stashElement.getAttribute(Page.DATA_ATTR);


var pages = module.exports = {

  /**
   *  @param {Object<String, String>} __pages Unlike the
   *  server version, where pages can be added one at a time,
   *  this version accepts only a mapping between page name
   *  and path to module.
   */
  
  add: function(_pages) {
    __pages = _pages;
  },

  fetch: function(name, callback) {
    var _Page = _Pages[name];
    if (_Page) tick(callback.bind(null, _Page));
    else {
      var __page = __pages[name];
      if (!__page) {
        throw new Error('Page not registered');
      }
      fetch([__page], function(proto) {
        _Page = BrowserPage.extend(
          merge(proto, {
            constructor: function(props) {
              this.name = name;
              this._super(props);
            }
          })
        );
        _Pages[name] = _Page;
        callback(_Page);
      });
    }
  },

  currentUri: null,

  currentPage: null,

  init: function() {
    pages._navType = ENTRY;
    pages.get(_entry.name, _entry.props);
    // Remove stash as a security precaution.
    //_stashElement.parentNode.removeChild(_stashElement);
    //_stashElement = _stash = null; // boop!
  }

};


// A browser call to onpopstate will be preceded by an update of
// document.location to the new url
// (http://www.w3.org/TR/2011/WD-html5-20110113/history.html#history-traversal).
window.onpopstate = function(event) {
  var state = event.state;
  console.log(state);
  if (state) {
    pages._navType = REVISIT;
    pages.get(state.name, state.props);
  }
};

var REVISIT = 0;
var REDIRECT = 1;
var ENTRY = 2;

['get', 'post'].forEach(function(verb) {
  pages[verb] = function(name, props, callback) {
    callback = callback || function() {};

    if (!window.history || !history.pushState) {
      tick(callback);
      return; // do nothing, page is actually static.
    }

    var pages = this;

    var currentPage = pages.currentPage;
    if (currentPage) {
      _stash[currentPage.uri()] = currentPage.stash || {};
    }

    pages.fetch(name, function(_Page) {
      var page = _Page(props);
      var uri = page.uri();

      page.stash = _stash[uri] || {};
      page.pages = pages;

      // Requesting the same page that is already loading or has already
      // been loaded.
      currentPage = pages.currentPage;
      if (currentPage && uri === currentPage.uri()) {
        return callback();
      }
      pages.currentPage = page;

      switch (pages._navType) {
        case REDIRECT:
        case ENTRY:
          history.replaceState(page.state(), null, uri);
          break;
        case REVISIT:
          // This was the result of a pop state.
          break;
        default:
          // Default is a new page.
          history.pushState(page.state(), null, uri);
          break;
      }

      page[verb](function() {
        var err;
        if (uri !== pages.currentPage.uri()) {
          err = new Error('Rendering interrupted by navigation');
        }
        else if (page._redirect) {
          var redirect = page._redirect;
          pages._navType = REDIRECT;
          pages.get(redirect.name, redirect.props);
        }
        else {
          page.renderToDocument();
          page.run();
        }
        callback(err);
      });
    });
  };
});

