var Page = require('./page');
//var Path = require('osh-path');
var escape = require('escape-html');
var extend = require('xtend/mutable');
var temp = require('temp').track();


var ServerPage = Page.extend({
  constructor: function(props) {
    this.stash = {};
    this._super(props);
  },

  send: function() {
    var page = this;
    page[page.verb](function() {
      if (!page._redirected) {
        var html = page.renderToString();
        page._res.status(page.status || 200);
        page._res.send(html);
      }
    });
  },

  redirect: function(name, props) {
    this._redirected = true;
    var page = this.pages.instantiate(name, props);
    this._res.redirect(page.uri());
  },

  renderToString: function() {
    var pages = this.pages;
    return (
      '<!DOCTYPE html>' +
      '<html>' +
        '<head>' + 
          '<title>' + escape(this.title || '') + '</title>' +
          (this.head || '') +
        '</head>' +
        '<body>' +
          '<div id="' + Page.MOUNT_ID + '">' +
            ('string' == typeof this.body ? this.body : '') +
          '</div>' +
          '<span ' +
            'id="' + Page.STASH_ID + '" ' +
            Page.NAME_ATTR + '="' + escape(this.name) + '" ' +
            Page.DATA_ATTR + '="' + escape(
              JSON.stringify(this.stash)
                //this.stash(page.props)
              //)
            ) + '" ' +
            Page.PROPS_ATTR + '="' + escape(
              JSON.stringify(this.props)
            ) + '" ' +
            Page.URI_ATTR + '="' + escape(this.uri()) +
          '">' +
          '</span>' +
          (this.scripts || '') + pages.scripts(this.name) +
        '</body>' +
      '</html>'
    );
  }
});

/**
 *  When we render on the server, each data namespace for the page
 *  has the opportunity to trim what is actually stashed. The stash function
 *  is given the data object fetched from the API server and returns an object
 *  that holds a subset of its data.
 *
 *  data.<namespace>.stash can be a function, otherwise it is interpreted as a
 *  Boolean.
 */

/**
 *  Always stash these properties. This acts as a whitelist.
 *  Do not include 'data' as a key in this hash; it is treated specially.
 */

var STASH = {
  id: null,
  params: null,
  query: null,
  uri: null
};

module.exports = ServerPage;
