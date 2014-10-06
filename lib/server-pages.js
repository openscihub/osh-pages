var fs = require('fs');
var escape = require('escape-html');
var extend = require('xtend');
var merge = require('xtend/immutable');
var Dynapack = require('dynapack');
var temp = require('temp').track();
var ServerPage = require('./server-page');
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

  _add: function(name, proto) {
    if (this.strict && this._bundled) {
      throw new Error(
        'Page added after bundling!'
      );
    }

    if ('string' == typeof proto) {
      this.__pages[name] = proto;
      proto = require(proto);
    }
    else {
      // Issue warning, b/c without a path to a prototype
      // file, we cannot bundle
      console.warn(
        'Warning: Page "' + name + '" will not be bundled; ' +
        'i.e. it will be served as a static page.'
      );
    }

    var pages = this;

    this._Pages[name] = ServerPage.extend(
      merge(proto, {
        constructor: function(props) {
          this._super.apply(this, arguments);
        },

        render: function() {
          this.scripts = (this.scripts || '') + this.bundles();
          return this.renderToString();
        },

        bundles: function() {
          if (!this._bundles) {
            this._bundles = pages._scripts[name].map(
              function(script) {
                return '<script async src="' + script + '"></script>';
              }
            ).join('');
          }
          return this._bundles;
        }
      })
    );
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
        'pages.render("' + name + '");'
      );

      entries[name] = __entry;
      //Entry({
      //  name: name,
      //  page: __pages[name],
      //  map: map
      //});
    }

    var self = this;
    var packer = Dynapack(entries, opts);
    packer.run(function() {
      packer.write(function(err, scripts) {
        self._scripts = scripts;
        callback && callback(err, scripts);
        self.emit('bundled', scripts);
        self._bundled = true;

        if (!opts.keepEntries) {
          for (var name in entries) {
            fs.unlinkSync(entries[name]);
          }
        }
      });
    });
  }

});

['get', 'post'].forEach(function(verb) {
  ServerPages.prototype[verb] = function(name) {
    var _Page = this._Pages[name];
    if (!_Page) {
      throw new Error(
        'Page "' + name + '" was not added.'
      );
    }

    _Page = _Page.extend({
      constructor: function(props) {
        this._super(props);
      },

      send: function() {
        var page = this;
        page[verb](function() {
          var html = page.render();
          page._res.status(page.status || 200);
          page._res.send(html);
        });
      }
    });

    var middleware = [
      function(req, res, next) {
        res.page = _Page(req.params);
        res.page._res = res;
        res.page._req = req;
        next();
      }
    ]
    .concat(
      Array.prototype.slice.call(arguments, 1)
    );

    _Page.prototype.path.serve(
      this.app,
      verb,
      middleware
    );
  };
});

ServerPages.Page = ServerPage;

module.exports = ServerPages;
