var Class = require('osh-class');
var merge = require('xtend/immutable');

var Page = Class({
  constructor: function(props) {
    this.props = merge(props);
  },

  setProps: function(props) {
    this.props = merge(this.props, props);
  }
});



/**
 *  Constants for use in subclasses; needed by both browser and server for
 *  rendering html and transferring data in DOM.
 */

Page.STASH_ID = '__stash';
Page.DATA_ATTR = 'data-data';
Page.PROPS_ATTR = 'data-props';
Page.URI_ATTR = 'data-uri';
Page.MOUNT_ID = '__mount';


Page.prototype.id = function() {
  return this.path.pattern;
};

Page.prototype.uri = function() {
  return this.path.uri(this.props);
};

module.exports = Page;