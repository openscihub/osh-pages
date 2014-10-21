var fs = require('fs');
var escape = require('escape-html');
var extend = require('xtend');
var merge = require('xtend/immutable');
var Dynapack = require('dynapack');
var Class = require('osh-class');
var EventEmitter = require('events').EventEmitter;
var Readable = require('stream').Readable;
var crypto = require('crypto');
var path = require('path');
var express = require('express');


var ServerPages = Class(EventEmitter, {
  constructor: function(opts) {
    opts = opts || {};
    this.app = opts.app || express();
    this.strict = true;
    this._Pages = {};
    this.__pages = {};
  },

  add: function(name, proto) {
    if ('string' == typeof name) {
      if (!proto) {
        throw new Error(
          'Need to provide a prototype for page ' + name
        );
      }
      this._add(name, proto);
    }
    else {
      var pages = name;
      for (name in pages) {
        this._add(name, pages[name]);
      }
    }
  },

  _add: function(name, Page) {
    if (this.strict && this._bundled) {
      throw new Error(
        'Page added after bundling!'
      );
    }

    if ('string' == typeof Page) {
      this.__pages[name] = Page;
      Page = require(Page);
    }
    else {
      // Issue warning, b/c without a path to a Pagetype
      // file, we cannot bundle
      console.warn(
        'Warning: Page "' + name + '" will not be bundled; ' +
        'i.e. it will be served as a static page.'
      );
    }

    this._Pages[name] = this._extendPage(Page, name);
  },

  _extendPage: function(Page, name) {
    return Page.extend({

      name: name,

      pages: this,

      renderToString: function() {
        this.scripts = (this.scripts || '') + this.pages.scripts(this.name);
        return Page.prototype.renderToString.call(this);
      },

      redirect: function(name, props) {
        var page = this.pages.instantiate(name, props);
        Page.prototype.redirect.call(this, page);
      }

    });
  },

  instantiate: function(name, props) {
    var Page = this._Pages[name];
    if (!Page) {
      throw new Error(
        'Page "' + name + '" was not added.'
      );
    }
    var page = Page(props);
    return page;
  },

  path: function(name) {
    return this._Pages[name]().path;
  },

  bundle: function(opts, callback) {
    var entries = {};
    var __pages = this.__pages;

    var map = (
      'pages.add({\n' +
        Object.keys(__pages).map(function(name) {
          return '  ' + name + ': "' + __pages[name] + '" /*js*/';
        })
        .join(',\n') + '\n' +
      '});\n'
    );

    var __page;
    var __entry;
    var bundleId = crypto.pseudoRandomBytes(4).toString('hex');

    for (var name in __pages) {
      __page = __pages[name];
      __entry = path.join(
        path.dirname(__page),
        'entry-' + bundleId + '.' + path.basename(__page)
      );

      fs.writeFileSync(__entry,
        'var pages = require("' +
          require.resolve('./browser-pages') +
        '");\n' +
        map +
        'require("' + __page + '");\n' +
        'pages.recover("' + name + '");'
      );

      entries[name] = __entry;
    }

    var pages = this;
    var packer = Dynapack(entries, opts);
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

['get', 'post'].forEach(function(verb) {
  ServerPages.prototype[verb] = function(name) {
    var pages = this;

    var middleware = [
      function(req, res, next) {
        res.page = pages.instantiate(name, req.params);
        res.page.verb = verb;
        res.page._res = res;
        res.page._req = req;
        next();
      }
    ]
    .concat(
      Array.prototype.slice.call(arguments, 1)
    );

    pages.path(name).serve(
      pages.app,
      verb,
      middleware
    );
  };
});

module.exports = ServerPages;
