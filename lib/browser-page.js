'use strict';

var Page = require('./page');

var _body = document.getElementById(Page.MOUNT_ID);

/**
 *  Listen in on the creation of a Page to store the instance in a
 *  registry. We need the registry to render pages on popstate events.
 */

var BrowserPage = Page.extend({
  constructor: function(props) {
    this._super(props);
    this.stash = {};
    this.bodyElement = _body;
  },

  state: function(props) {
    return {
      name: this.name,
      props: this.props
    };
  },

  redirect: function(name, props) {
    this._redirect = {
      name: name,
      props: props
    };
  },

  /**
   *  Actually renders to the DOM. Huh. Override this when
   *  you want to use a fancier renderer, like ReactJS.
   */
  
  renderToDocument: function() {
    var page = this;
    document.title = page.title;
    page.bodyElement.innerHTML = (
      'string' == typeof page.body ?
      page.body :
      'Body was not a string!'
    );
  },

  run: function() {
    // noop
  }
});

module.exports = BrowserPage;
