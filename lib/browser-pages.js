'use strict';

var fetch = require('dynafetch')(require);
var merge = require('xtend/immutable');
var tick = process.nextTick;


/**
 *  Mapping from page name to module name that exports
 *  page prototype.
 */

var __pages = {};

var _cache = {};

var pages = module.exports = {

  haveHistory: !!window.history && !!history.pushState,

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
    var __page = __pages[name];
    if (!__page) {
      throw new Error('Page ' + name + ' not registered');
    }
    fetch([__page], callback);
  },

  init: function(name, props, callback) {
    this.fetch(name, function(Page) {
      var page = Page(props);
      page.stash = {};
      page.pages = pages;
      page.name = name;
      page.cache = _cache[page.uri()];
      callback(page);
    });
  },

  _current: null,

  _next: null,

  recover: function(name) {
    var pages = this;
    pages.init(name, {}, function(page) {
      page.recover();
      if (!pages.schedule(page)) {
        throw new Error('Could not recover ' + page.uri());
      }
      pages.transition(page);
    });
  },

  /**
   *  Schedule a transition to a new page. This returns an id if
   *  page preparation should proceed, otherwise, it returns falsey.
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

  schedule: function(page) {
    if (!this.haveHistory) return;

    var uri = page.uri();
    var next = this._next;
    var current = this._current;

    if (next && uri === next.uri()) return; // already scheduled
    if (next) next.abort();

    var state = page.state();
    if (next || !current) {
      history.replaceState(state, null, uri);
    }
    else if (current && history.state.props !== page.props) {
      history.pushState(state, null, uri);
    }

    this._next = page;

    if (current && uri === current.uri()) return;

    return true;
  },

  /**
   *  The outstanding transitions. The first element of this array
   *  is a reference to the page to which we are currently transitioning.
   *
   *
   */

  _transitions: [],

  /**
   *  Start the transition to the given prepared page. The transition will
   *  occur only if the page was previously scheduled and no other schedules
   *  have occurred while the page was being prepared.
   *
   *  Example of a transition request failure:
   *
   *    - schedule p1
   *    - schedule p2
   *    - transition to p1 (fails)
   *    - transition to p2 (succeeds)
   *    - render p2
   *
   *  Example of a transition delay:
   *
   *    - schedule p1
   *    - transition to p1
   *    - schedule p2
   *    - transition to p2 (delayed)
   *    - render p1
   *    - transition to p2 (automatic)
   *    - render p2
   */

  transition: function(page) {
    if (page !== this._next) return;
    this._next = null;
    if (this._transitions.push(page) === 1) {
      // no transitions in progress.
      this.go();
    }
  },

  /**
   *  Run all outstanding transitions.
   */

  go: function() {
    var pages = this;
    var page = pages._transitions[0];
    if (page) {
      if (!pages._current) run();
      else if (page.renderToDocument.length) {
        page.renderToDocument(run);
      }
      else {
        page.renderToDocument();
        run();
      }
    }

    function run() {
      page.run();
      pages._current = page;
      pages._transitions.shift();
      page = null;
      pages.go();
    }
  }

};


// A browser call to onpopstate will be preceded by an update of
// document.location to the new url
// (http://www.w3.org/TR/2011/WD-html5-20110113/history.html#history-traversal).
window.onpopstate = function(event) {
  var state = event.state;
  console.log(state);
  if (state) {
    pages[state.verb](state.name, state.props);
  }
};


['get', 'post'].forEach(function(verb) {
  pages[verb] = function(name, props, callback) {
    callback = callback || function() {};
    var pages = this;
    var payload;

    if (!pages.haveHistory) {
      tick(callback);
      return; // do nothing, page is actually static.
    }

    pages.init(name, props, function(page) {
      if (!pages.schedule(page)) {
        return callback();
      }

      page.payload = payload;

      page[verb](function() {
        if (page._redirect) {
          var redirect = page._redirect;
          pages.get(redirect.name, redirect.props);
        }
        else {
          pages.transition(page);
        }
        callback();
      });
    });

    return {
      send: function(_payload) {
        payload = _payload;
      }
    };
  };
});
