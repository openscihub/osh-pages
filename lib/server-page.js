var Page = require('./page');
//var Path = require('osh-path');
var escape = require('escape-html');
var extend = require('xtend');
var temp = require('temp').track();


var ServerPage = Page.extend({
  constructor: function(props) {
    this._super(props);
  }
});

ServerPage.prototype.redirect = function(name, props) {
  this._pages;
  this._res.redirect();
};


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

ServerPage.prototype.stash = function(props) {
  var stash;
  var _props = {data: {}};
  var name;
  if (props.data) {
    for (name in this.data) {
      stash = this.data[name].stash;
      if ('function' == typeof stash) {
        _props.data[name] = stash(props.data[name]);
      }
      else if (stash) {
        _props.data[name] = props.data[name];
      }
    }
  }
  for (name in props) {
    if (name in STASH) {
      _props[name] = props[name];
    }
  }
  return _props;
};


ServerPage.prototype.renderToString = function() {
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
          Page.DATA_ATTR + '="' + escape(
            JSON.stringify(this.stash)
              //this.stash(page.props)
            //)
          ) + '" ' +
          Page.PROPS_ATTR + '="' + escape(
            JSON.stringify(this.props)
          ) + '" ' +
          Page.URI_ATTR + '="' + escape(this.uri()) + '" ' +
        '">' +
        '</span>' +
        (this.scripts || '') +
      '</body>' +
    '</html>'
  );
};

ServerPage.prototype.renderScripts = function() {
  return '';
};

ServerPage.prototype.render = function(done) {
  this.fetchData(function(err, data) {
    var page = {
      title: this.renderTitle(data),
      head: this.renderHead(data),
      body: this.renderBody(data),
      stash: this.stash(data),
      scripts: this.renderScripts(data)
    };
    done(null, this.renderToString(page));
  }.bind(this));
};

module.exports = ServerPage;
