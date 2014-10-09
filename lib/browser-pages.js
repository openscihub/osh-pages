'use strict';

var Page = require('./base');
var fetch = require('./fetch');
var extend = require('xtend');


/**
 *
 */

var _Pages = {};

/**
 *  Listen in on the creation of a Page to store the instance in a
 *  registry. We need the registry to render pages on popstate events.
 */

var BrowserPage = Page.extend({
  constructor: function(opts) {
    if (uri === BrowserPage.stashUri) {
      opts = merge(BrowserPage.stashOpts, opts || {});
    }
    this._super(opts);
    _Pages[this.id()] = this.constructor;
  }
});


// A browser call to onpopstate will be preceded by an update of
// document.location to the new url
// (http://www.w3.org/TR/2011/WD-html5-20110113/history.html#history-traversal).
window.onpopstate = function(event) {
  var state = event.state;
  console.log(state);
  if (state) {
    var Page = _Pages[state.id];
    (new Page(state.opts)).render();
  }
};


/**
 *  @param {Object<String, String>} __pages Unlike the
 *  server version, where pages can be added one at a time,
 *  this version accepts only a mapping between page name
 *  and path to module.
 */

BrowserPages.prototype.add = function(pages) {
  __pages = pages;
  for (var name in pages) {
    _Pages[name] = BrowserPage.extend(pages[name], {
      constructor: function() {
        this._super.apply(this, arguments);
      },

      renderToDocument

    });
};


['get', 'post'].forEach(function(verb) {
  BrowserPages.prototype[verb] = function(name, props, callback) {
    var pages = this;
    var page = _Pages[name](props);

  var stash = pages.stash;
  var uri = page.uri();
  var isEntry = (uri === stash.uri);

  if (!window.history || !history.pushState) {
    if (!isEntry) document.location.href = uri;
    return;
  }

  // Requesting the same page that is already loading or has already
  // been loaded.
  if (uri === pages.currentUri) return;
  pages.currentUri = uri;

  if (isEntry && history.state === null) {
    // First render.
    history.replaceState(
      page.state(), null, document.location.href
    );
    page.stash = _stash.data;
    page.run();
    var data = merge(BrowserPage.stashData, this.findData());
    this.startUI(data);

    // Remove stash as a security precaution.
    var stash = BrowserPage.stash;
    stash.parentNode.removeChild(stash);
    stash = BrowserPage.stash = null; // boop!
  }
  else {
    history.pushState(this.state(), null, uri);

    this.fetchData(function(err, data) {
      if (err) callback && callback(err);
      else if (uri !== currentUri) {
        callback && callback(
          new Error('Rendering interrupted by navigation')
        );
      }
      else {
        var page = {
          title: this.renderTitle(data),
          head: this.renderHead(data),
          body: this.renderBody(data),
          scripts: this.renderScripts(data)
        };
        this.renderToDocument(page);
        this.startUI();
        callback && callback();
      }
    }.bind(this));
  }




    page.pages = pages;
    page[verb](function() {
      if (page._redirect) {
        var redirect = page._redirect;
        pages.get(redirect.name, redirect.props);
      }
      else {
        page.renderToDocument();
        page.run();
      }
    });
  };
});


BrowserPage.prototype.state = function(props) {
  return {
    id: this.id(),
    opts: this.opts
  };
};


/**
 *  Keep track of the currently loading uri so we can abandon
 *  outdated requests.
 */

var currentUri;

/**
 *  Conditional render. Only if uri is current.
 */

BrowserPage.prototype._render = function(page) {
  if (page.props.uri === currentUri) {
    this.render(page);
    this.ui(page);
  }
  else {
    return new Error(
      'Navigation to ' + page.props.uri + ' interrupted by request for ' +
      currentUri + '.'
    )
  }
};

BrowserPage.prototype.findData = function() {
  return {};
};

BrowserPage.currentUri = null;

/**
 *  Navigate to new page in browser. Does the loading and rendering
 *  (or ignoring if another navigation supercedes the current one).
 *
 *  This operation does not modify browser History. Therefore, this
 *  method must always render the latest page request (even if 4xx, 5xx).
 */

BrowserPage.prototype.render = function(callback) {
  var uri = this.uri();
  var isEntry = (uri === BrowserPage.stashUri);

  if (!window.history || !history.pushState) {
    if (!isEntry) document.location.href = uri;
    return;
  }

  // Requesting the same page that is already loading or has already
  // been loaded.
  if (uri === BrowserPage.currentUri) return;
  BrowserPage.currentUri = uri;

  if (isEntry && history.state === null) {
    // First render.
    history.replaceState(
      this.state(), null, document.location.href
    );
    var data = merge(BrowserPage.stashData, this.findData());
    this.startUI(data);

    // Remove stash as a security precaution.
    var stash = BrowserPage.stash;
    stash.parentNode.removeChild(stash);
    stash = BrowserPage.stash = null; // boop!
  }
  else {
    history.pushState(this.state(), null, uri);

    this.fetchData(function(err, data) {
      if (err) callback && callback(err);
      else if (uri !== currentUri) {
        callback && callback(
          new Error('Rendering interrupted by navigation')
        );
      }
      else {
        var page = {
          title: this.renderTitle(data),
          head: this.renderHead(data),
          body: this.renderBody(data),
          scripts: this.renderScripts(data)
        };
        this.renderToDocument(page);
        this.startUI();
        callback && callback();
      }
    }.bind(this));
  }
};

/**
 *  Navigate to new page in browser. Calls pushState then this._navigate().
 */

BrowserPage.prototype.visit = function(opts, callback) {
  //console.log('visit opts:', opts);
  var uri = this.path.uri(opts);
  if (uri !== document.location.href) {
    history.pushState(this.state(opts), null, uri);
  }
  this._navigate(opts, callback);
};




BrowserPage.body = document.getElementById(Page.MOUNT_ID);
BrowserPage.stash = document.getElementById(Page.STASH_ID);

BrowserPage.stashUri = BrowserPage.stash.getAttribute(Page.URI_ATTR);
BrowserPage.stashData = JSON.parse(
  BrowserPage.stash.getAttribute(Page.DATA_ATTR)
);
BrowserPage.stashOpts = JSON.parse(
  BrowserPage.stash.getAttribute(Page.OPTS_ATTR)
);


/**
 *  Actually renders to the DOM. Huh. Override this when
 *  you want to use a fancier renderer, like ReactJS.
 */

BrowserPage.prototype.renderToDocument = function(page) {
  document.title = page.title;
  BrowserPage.body.innerHTML = (
    'string' == typeof page.body ?
    page.body :
    'Body was not a string!'
  );
};


BrowserPage.prototype.domProps = function() {
  // Load stashed props.
  var props = extend(BrowserPage.stash);

  // Load props from DOM by dev.

  var data = props.data = props.data || {};
  //console.log('Before find():', JSON.stringify(props));
  var find;
  for (var namespace in this.data) {
    if (find = this.data[namespace].find) {
      data[namespace] = find(data[namespace]);
    }
  }
  //console.log('After find():', JSON.stringify(props));

  return props;
};


module.exports = BrowserPage;
