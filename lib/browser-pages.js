'use strict';

var fetch = require('dynafetch')(require);
var merge = require('xtend/immutable');
var extend = require('xtend/mutable');
var tick = process.nextTick;
var BrowserPage = require('./browser-page');
var Stash = require('./browser-stash');
var csrf = require('./browser-csrf');
var Pages = require('./pages');
var session = require('./browser-session');
var EventEmitter = require('component-emitter');

var pages = new Pages({
  Page: BrowserPage
});

extend(pages, {

  haveHistory: !!window.history && !!history.pushState,

  __pages: {},

  set: function(methods, name, __page) {
    pages.__pages[name] = __page;
    pages._setMethods(name, methods);
  },

  fetch: function(name, callback) {
    //console.log('get Page', name, Date.now() - __start, 'ms');
    var Page = pages._cache[name];
    if (Page) {
      return tick(callback.bind(null, Page));
    }
    var __page = pages.__pages[name];
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

  init: function() {
    if (!pages.haveHistory) {
      return console.warn('No AJAX without history API');
    }
    pages.request('GET', Stash.name, Stash.props, function(page) {
      if (!page) {
        throw new Error('Could not recover.');
      }
      page.setState(Stash.state);
      page.recoverState();
      pages._preparing = null;
      pages._rendered = page;
      ajaxify();
      pages.run(page);
    });
  },

  /**
   *  Either a route or a page.
   */

  _preparing: null,

  _rendered: null,

  render: function(page) {
    if (page !== pages._preparing) return;
    pages._preparing = null;
    page.renderToDocument({
      csrf: csrf,
      current: pages.current()
    });
    pages._rendered = page;
  },

  run: function(page) {
    // Do not run if there was an interruption.
    if (page !== pages._rendered) return;
    page.run({
      csrf: csrf,
      go: pages.go,
      submit: pages.submit
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

  request: function(method, nameOrUri, propsOrUndefined, callback) {
    var route = pages.route(method, nameOrUri, propsOrUndefined);
    if (!route) {
      pages.go('4xx', extend(
        {code: 404},
        propsOrUndefined === undefined ?
        {uri: nameOrUri} :
        {
          name: nameOrUri,
          props: propsOrUndefined
        }
      ));
      return tick(callback);
    }

    var uri = route.uri;
    var action = route.action;
    var preparing = pages._preparing;
    var rendered = pages._rendered;

    if (preparing && action === preparing.action) {
      //console.log(preparing.action, 'already scheduled');
      return;
    }
    if (preparing) {
      try {
        // Cancel the outstanding request
        preparing.abort && preparing.abort();
      }
      catch (e) {}
    }

    if (method === 'GET') {
      // Update history.
      if (preparing && preparing.method === 'GET' || !rendered) {
        // If interrupting a GET preparation, we want to overwrite the previous
        // change to the browser history; i.e. we don't want the aborted page
        // showing up in the history stack. Probably. If there's no rendered
        // page, then this is the first scheduling and we must replaceState.
        //if (preparing) console.log('aborted', preparing.action);
        //else console.log('first scheduling');
        //console.log('replacing state', route, uri);
        history.replaceState(route, null, uri);
      }
      else if (action === rendered.action) return; // Unnecessary page request.
      else {
        //console.log('new page');
        //console.log('pushing state', route, uri);
        history.pushState(route, null, uri);
      }
    }
    //console.log('scheduled', action, 'at', Date.now() - __start, 'ms');

    pages._preparing = route;

    pages.fetch(route.name, function(Page) {
      if (!Page || route !== pages._preparing) callback();
      else {
        var page = pages._preparing = new Page();
        extend(page, route);
        callback(page);
      }
    });
  },

  current: function() {
    var rendered = pages._rendered;
    return rendered && {
      name: rendered.name,
      props: rendered.props,
      state: rendered.state
    };
  },

  go: function(nameOrUri, propsOrUndefined) {
    pages.request('GET', nameOrUri, propsOrUndefined, function(page) {
      page && pages._readRenderRun(page);
    });
  },

  _readWriteHook: function() {
    return {
      current: pages.current(),
      session: session
    };
  },

  _readRenderRun: function(page) {
    page.read(pages._readWriteHook(), function() {
      if (arguments.length) {
        // redirection
        pages.go.apply(null, arguments);
      }
      else {
        pages.render(page);
        pages.run(page);
      }
    });
  },

  _writeRedirect: function(page) {
    page.write(pages._readWriteHook(), function() {
      if (pages._preparing === page) {
        pages._preparing = null;
        pages.go.apply(null, arguments);
      }
    });
  },

  submit: function(form) {
    var method = form.method.toUpperCase();
    var uri = form.action;
    var multipart = (form.enctype === 'multipart/form-data');
    var json = !multipart && {};
    var parts = multipart && [];

    // Kick this off first; guaranteed async...
    pages.request(method, uri, undefined, function(page) {
      if (page) {
        if (method === 'POST') {
          page.payload = json || new EventEmitter();
          pages._writeRedirect(page);

          if (parts) {
            var payload = page.payload;
            var emit = payload.emit;
            for (var i = 0, len = parts.length; i < len; i++) {
              emit.apply(payload, parts[i]);
            }
            emit.call(payload, 'finish');
          }
        }
        else {
          extend(page.props, json);
          pages._readRenderRun(page);
        }
      }
    });

    // Parse the form while waiting.
    var element;
    for (var i = 0, len = form.elements.length; i < len; i++) {
      element = form.elements[i];
      if (element.type in pages.IGNORE_INPUT_TYPES) continue;
      if (element.name === csrf.name) continue;
      if (multipart) {
        var isFile = element.type === 'file';
        var file = isFile && element.files[0];
        parts.push([
          isFile ? 'file' : 'field',
          element.name,
          file || element.value,
          file && file.name,
          null,
          file && file.type
        ]);
      }
      else {
        json[element.name] = element.value;
      }
    }
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

  IGNORE_INPUT_TYPES: {
    submit: 1,
    button: 1
  }

});


function ajaxify() {
  // A browser call to onpopstate will be preceded by an update of
  // document.location to the new url
  // (http://www.w3.org/TR/2011/WD-html5-20110113/history.html#history-traversal).
  window.onpopstate = function(event) {
    var state = event.state;
    //console.log('pop state:', state);
    state && pages.go(state.name, state.props);
  };
  
  window.onclick = function(event) {
    var a = event.target;
    if (a && a.tagName === 'A' && a.host === location.host) {
      var route;
      try {
        event.preventDefault();
        pages.go(a.href);
      }
      catch (err) {
        // Follow the link.
      }
    }
  };
  
  window.onsubmit = function(event) {
    event.preventDefault();
    pages.submit(event.target);
  };
}

module.exports = pages;
