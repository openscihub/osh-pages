'use strict';

var fetch = require('dynafetch')(require);
var merge = require('xtend/immutable');
var extend = require('xtend/mutable');
var tick = process.nextTick;
var BrowserPage = require('./browser-page');
var Stash = require('./browser-stash');
var Router = require('./router');
var PageRequest = require('./page-request');
var csrf = require('./browser-csrf');
var Pages = require('./pages');


/**
 *  Mapping from page name to module name that exports
 *  page prototype.
 */

var _cache = {};

var pages = new Pages({
  Page: BrowserPage
});

extend(pages, {

  haveHistory: !!window.history && !!history.pushState,

  __pages: {},

  set: function(methods, name, __page) {
    this.__pages[name] = __page;
    this._setMethods(name, methods);
  },

  request: function() {
    if (!this.haveHistory) {
      // do nothing, page is actually static.
      return console.warn('No AJAX without history API');
    }
    var route = this.route.apply(this, arguments);
    if (!route) {
      // This is a bad place. It means the developer is requesting
      // a page that cannot exist. This should never happen.
      throw new Error(
        'Route does not exist! Tell the developer!'
      );
    }
    return new PageRequest(this, route);
  },

  go: function(nameOrUri, propsOrUndefined) {
    pages.request('GET', nameOrUri, propsOrUndefined).end();
  },

  post: function(nameOrUri, propsOrUndefined) {
    return pages.request('POST', nameOrUri, propsOrUndefined);
  },

  fetch: function(name, callback) {
    //console.log('get Page', name, Date.now() - __start, 'ms');
    var Page = this._cache[name];
    if (Page) {
      return tick(callback.bind(null, Page));
    }
    var __page = this.__pages[name];
    if (!__page) {
      throw new Error('Page ' + name + ' not registered');
    }
    //console.log('start Page fetch for', name, Date.now() - __start, 'ms');
    fetch([__page], function(proto) {
      //console.log('Page', name, 'fetched', Date.now() - __start, 'ms');
      Page = pages._setPrototype(name, proto);
      callback(Page);
      Page = null;
    });
  },

  _current: null,

  /**
   *  Either a route or a page.
   */

  _next: null,

  recover: function(name) {
    var pages = this;
    var route = pages.route('GET', name, Stash.props);
    pages.schedule(route, function(page) {
      if (!page) {
        throw new Error('Could not recover.');
      }
      page.setState(Stash.state);
      page.recoverState();
      pages.transition(page);
    });
  },

  /**
   *  Schedule a transition to a new page.
   *
   *  The first form takes the name of the page and a props object.  Simply
   *  look up the page by name and instantiate with the props.  For example:
   *
   *    pages.instantiate('view-user', {username: 'tory'}, callback);
   *
   *  The second form finds the page by iterating through all routes (of the
   *  given method) until props are parsed from the given uri. Example:
   *
   *    pages.instantiate('GET', '/users/tory', callback);
   *
   *  This form can fail if the method+uri is not recognized by any registered
   *  route. In this case, we throw an error.
   *
   *
   *     next |current | new=next | new=current || replace | push | abort-next | ret
   *    ------+--------+----------+-------------++---------+------+------------+-----
   *  1  yes  |  yes   |   yes    |     no      ||    no   |  no  |    no      |  f
   *    ------+--------+----------+-------------++---------+------+------------+-----
   *  2  yes  |  yes   |   no     |     yes     ||   yes   |  no  |    yes     |  f
   *    ------+--------+----------+-------------++---------+------+------------+-----
   *  3  yes  |  yes   |   no     |     no      ||   yes   |  no  |    yes     |  t
   *    ------+--------+----------+-------------++---------+------+------------+-----
   *  4  yes  |   no   |   yes    |     no      ||    no   |  no  |     no     |  f
   *    ------+--------+----------+-------------++---------+------+------------+-----
   *  5  yes  |   no   |   no     |     no      ||   yes   |  no  |    yes     |  t
   *    ------+--------+----------+-------------++---------+------+------------+-----
   *  6   no  |  yes   |   no     |     yes     ||    no   |  no  |    no      |  f
   *    ------+--------+----------+-------------++---------+------+------------+-----
   *  7   no  |  yes   |   no     |     no      ||    no   | yes  |    no      |  t
   *    ------+--------+----------+-------------++---------+------+------------+-----
   *  8   no  |   no   |   no     |     no      ||   yes   |  no  |    no      |  t
   *
   */

  schedule: function(route, callback) {
    var pages = this;
    if (!pages.haveHistory) return;

    var uri = route.uri;
    var next = pages._next;
    var current = pages._current;

    if (next && uri === next.uri) {
      console.log(next.uri, 'already scheduled');
      return; // already scheduled
    }
    if (next) next.abort && next.abort(); // Cancel the outstanding page request

    if (next || !current) {
      // If next is true, we don't want the aborted page showing up in
      // the history. Probably. If there's no current page, then pages
      // is the first scheduling.
      if (next) console.log('aborted', next.uri);
      else console.log('first scheduling');
      history.replaceState(route, null, uri);
    }
    else if (current) {
      // No interruption.
      if (uri === current.uri) return; // Unnecessary page request.
      console.log('new page');
      history.pushState(route, null, uri);
    }
    //console.log('scheduled', uri, 'at', Date.now() - __start, 'ms');

    pages._next = route;

    pages.fetch(route.name, function(Page) {
      if (!Page || route !== pages._next) callback();
      else {
        var page = pages._next = new Page();
        extend(page, route);
        callback(page);
      }
    });
  },

  transition: function(page) {
    if (page !== this._next) return;
    this._next = null;

    var renderHook = {
      current: this._current,
      csrf: csrf,
      go: this.go,
      post: this.post
    };

    page.renderToDocument(renderHook);
    this._current = page;
    page.run(renderHook);
  },

// Old, complex page transitioning that may be unnecessary...
// For now, KISS, above.

//  /**
//   *  The outstanding transitions. The first element of this array
//   *  is a reference to the page to which we are currently transitioning.
//   */
//
//  _transitions: [],
//
//  /**
//   *  Start the transition to the given prepared page. The transition will
//   *  occur only if the page was previously scheduled and no other schedules
//   *  have occurred while the page was being prepared.
//   *
//   *  Example of a transition request failure:
//   *
//   *    - schedule p1
//   *    - schedule p2
//   *    - transition to p1 (fails)
//   *    - transition to p2 (succeeds)
//   *    - render p2
//   *
//   *  Example of a transition delay:
//   *
//   *    - schedule p1
//   *    - transition to p1
//   *    - schedule p2
//   *    - transition to p2 (delayed)
//   *    - render p1
//   *    - transition to p2 (automatic)
//   *    - render p2
//   */
//
//  transition: function(page) {
//    if (page !== this._next) return;
//    this._next = null;
//    if (this._transitions.push(page) === 1) {
//      // no transitions in progress.
//      this._performTransitions();
//    }
//  },
//
//  /**
//   *  Run all outstanding transitions.
//   */
//
//  _performTransitions: function() {
//    var pages = this;
//    var page = pages._transitions[0];
//    if (page) {
//      if (!pages._current) run();
//      else if (page.renderToDocument.length == 2) {
//        page.renderToDocument(hook, run);
//      }
//      else {
//        page.renderToDocument(hook);
//        run();
//      }
//    }
//
//    function run() {
//      pages._current = page;
//      page.run();
//      pages._transitions.shift();
//      page = null;
//      pages._performTransitions();
//    }
//  },

  submit: function(form) {
    var method = form.method.toUpperCase();
    var uri = form.action;
    var req = this.request(method, uri);
    if (req) {
      var element;
      var json = {};
      for (var i = 0, len = form.elements.length; i < len; i++) {
        element = form.elements[i];
        if (form.enctype === 'multipart/form-data') {
          if (element.type in pages.IGNORE_INPUT_TYPES) continue;
          if (element.type === 'file') req.attach(element.name, element.files[0]);
          else req.field(element.name, element.value);
        }
        else {
          json[element.name] = element.value;
        }
      }
      if (form.enctype === 'application/x-www-form-urlencoded') {
        req.send(json);
      }
      req.end();
    }
  },

  IGNORE_INPUT_TYPES: {
    submit: 1,
    button: 1
  }

});


// A browser call to onpopstate will be preceded by an update of
// document.location to the new url
// (http://www.w3.org/TR/2011/WD-html5-20110113/history.html#history-traversal).
window.onpopstate = function(event) {
  var state = event.state;
  console.log(state);
  if (state) {
    pages.request(state.name, state.props).end();
  }
};

window.onsubmit = function(event) {
  event.preventDefault();
  pages.submit(event.target);
};

module.exports = pages;
