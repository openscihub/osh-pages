var fs = require('fs');
var escape = require('escape-html');
var extend = require('xtend/mutable');
var merge = require('xtend/immutable');
var Dynapack = require('dynapack');
var EventEmitter = require('events').EventEmitter;
var Readable = require('stream').Readable;
var crypto = require('crypto');
var path = require('path');
var ServerPage = require('./server-page');
var Pages = require('./pages');
var mkdirp = require('mkdirp');

/** 
 *  A collection of methods to attach to the pages middleware.
 */

function ServerPages(opts) {
  opts = opts || {};
  opts.Page = opts.Page || ServerPage;

  this.strict = true;
  this.basedir = opts.basedir || process.cwd();
  this.__pages = {};

  Pages.call(this, opts);
}

extend(ServerPages.prototype, Pages.prototype, EventEmitter.prototype, {
  routes: function(__routes) {
    this.__routes = path.resolve(this.basedir, __routes);
    var routeConfigs = require(this.__routes);
    Pages.prototype.routes.call(this, routeConfigs);
  },

  set: function(name, __page) {
    __page = path.resolve(this.basedir, __page);
    this.__pages[name] = __page;

    var pages = this;
    var proto = require(__page);
    var methods = [];

    if (proto.read) methods.push('GET');
    if (proto.write) methods.push('POST');

    this._setMethods(name, methods);
    this._setPrototype(name, proto);
  },

  /**
   *  Return a page instance initialized with only route
   *  properties.
   *
   *  @param {String} action
   *  @param {String|Object} args
   */

  init: function(method, uri) {
    var route = this.route(method, uri);
    if (route) {
      var Page = this._cache[route.name];
      if (Page) {
        var page = new Page();
        return extend(page, route);
      }
    }
  },

  bundle: function(opts, callback) {
    var entries = {};
    var __pages = this.__pages;
    var __routes = this.__routes;
    var methods = this._methods;

    if (!opts.output) {
      throw new Error('Specify bundle output directory');
    }

    var entryHeader = (
      //'var pages = require("' + require.resolve('./browser-pages') + '");\n' +
      //'pages.routes(require("' + __routes + '"));\n' +
      //'pages.set({' +
      //  Object.keys(__pages).map(function(name) {
      //    return '"' + name + '": "' + __pages[name] + '"/*js*/';
      //  })
      //  .join(',\n') +
      //'});\n'

      'var pages = require("' + require.resolve('./browser-pages') + '");\n' +
      'pages.routes(require("' + __routes + '"));\n' +
      Object.keys(__pages).map(function(name) {
        return (
          'pages.set(' + 
            '["' + methods[name].join('", "') + '"], ' +
            '"' + name + '", ' +
            '"' + __pages[name] + '"/*js*/' +
          ');'
        );
      })
      .join('\n')
    );

    var __page;
    var __entry;
    var bundleId = crypto.pseudoRandomBytes(4).toString('hex');
    var output = path.resolve(this.basedir, opts.output);

    mkdirp.sync(output);

    for (var name in __pages) {
      __page = __pages[name];
      __entry = path.join(
        output,
        'entry-' + bundleId + '.' + path.basename(__page)
      );

      fs.writeFileSync(__entry,
        entryHeader +
        'require("' + __page + '");\n' +
        'pages.init();'
      );

      entries[name] = __entry;
    }

    var pages = this;
    var packer = Dynapack(entries, merge(opts, {output: output}));
    packer.run(function(err, chunks) {
      if (err) {
        if (callback) callback(err);
        else pages.emit('error', err);
      }
      else {
        packer.write(function(err, scripts) {
          if (err) {
            if (callback) callback(err);
            else pages.emit('error', err);
          }
          else {
            pages._scripts = scripts;
            pages._scriptsHtml = {};

            callback && callback(err, scripts);
            pages.emit('bundled', scripts);
            pages._bundled = true;

            if (!opts.keepEntries) {
              for (var name in entries) {
                fs.unlinkSync(entries[name]);
              }
            }
          }
        });
      }
    });
  },

  scripts: function(name) {
    var html = this._scriptsHtml[name];
    if (!html) {
      html = this._scriptsHtml[name] = this._scripts[name].map(
        function(script) {
          return '<script async src="' + script + '"></script>';
        }
      ).join('');
    }
    return html;
  }
});

module.exports = ServerPages;
