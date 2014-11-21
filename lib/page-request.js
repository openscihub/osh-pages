//var request = require('superagent');
var extend = require('xtend/mutable');
var EventEmitter = require('component-emitter');
var session = require('./browser-session');
var csrf = require('./browser-csrf');
var tick = process.nextTick;

/**
 *  A page request prototype for reading and writing data before
 *  displaying a page. Acts a lot like a superagent request. Returned
 *  from calls to pages.submit, pages.go, pages.request
 */

function PageRequest(pages, route) {
  this.pages = pages;
  this.route = route;
  this._parts = [];
  var current = pages._current;
  this._hook = {
    current: current && {
      name: current.name,
      props: current.props,
      state: current.state
    },
    session: session
  };
}

extend(PageRequest.prototype, {
  attach: function(name, file, filename) {
    // event, name, file, filename, encoding, mimetype
    this._parts.push([
      'file',
      name,
      file,
      filename || file && file.name,
      null,
      file && file.type
    ]);
    return this;
  },

  field: function(name, value) {
    this._parts.push(['field', name, value]);
    return this;
  },

  send: function(json) {
    if (!this._json) this._json = {};
    extend(this._json, json);
    return this;
  },

  /**
   *  Don't need secrets, we can read and write (e.g. query APIs)
   *  from right here.
   */

  _write: function(page, done) {
    var pages = this.pages;
    var parts = this._parts;
    var json = this._json;
    var payload;

    if (json) {
      if (csrf.name in json) payload = json;
      else {
        throw new Error('ECSRF: first <input> must be csrf token.');
      }
    }
    else if (parts.length) {
      //console.log(parts[0][1], csrf.name);
      //console.log(csrf);
      if (parts[0][1] !== csrf.name) {
        throw new Error(
          'ECSRF: multipart-encoded form; first <input> ' +
          'must be csrf token.'
        );
      }
      payload = new EventEmitter();
      var emit = payload.emit;
      tick(function() {
        for (var i = 1, len = parts.length; i < len; i++) {
          emit.apply(payload, parts[i]);
        }
        emit.call(payload, 'finish');
      });
    }

    page.payload = payload;
    page.write(this._hook, function(nameOrUri, propsOrUndefined) {
      pages.request('GET', nameOrUri, propsOrUndefined).end();
      done();
    });
  },

//  May not need this; private actions are handled by custom functions
//  on a Page prototype. NO longer all-or-nothing read/write secrecy.
//
//  _writePrivately: function(page, done) {
//    var req = request.post(page.uri);
//
//    req.query({__rw__: 1})
//    req.redirects(0);
//
//    // Send payload.
//
//    if (this._json) {
//      req.type('form');
//      req.send(this._json);
//    }
//    else if (this._parts.length) {
//      var part;
//      for (var i = 0, len = this._parts.length; i < len; i++) {
//        part = this._parts[i];
//        (
//          part[0] == 'a' ?
//          req.attach :
//          req.field
//        )
//        .apply(req, part.slice(1));
//      }
//    }
//
//    var pages = this.pages;
//    req.end(function(res) {
//      req = null;
//      if (res.statusType == 3) {
//        pages.request('GET', res.header['location']).end();
//        done();
//      }
//      else {
//        // Must get a redirection
//        done(new Error(
//          res.ok ?
//          'ENOREDIRECT: expect server redirect after private write.' :
//          res.body.message
//        ));
//      }
//    });
//  },

  _read: function(page, done) {
    var pages = this.pages;
    page.read(this._hook, function(name, props) {
      if (name) {
        pages.request('GET', name, props).end();
      }
      done();
    });
  },


//  May not need this; private actions are handled by custom functions
//  on a Page prototype. NO longer all-or-nothing read/write secrecy.
//
//  /**
//   *  Query the html server for private state. Making use of
//   *  private session data.
//   */
//
//  _readPrivately: function(page, done) {
//    var req = request.get(page.uri);
//
//    req.query({__rw__: 1})
//    req.redirects(0);
//
//    var pages = this.pages;
//    req.end(function(res) {
//      req = null;
//      if (!res.ok) {
//        done(new Error(res.body.message));
//      }
//      else {
//        if (res.statusType == 3) {
//          // Redirection
//          pages.request('GET', res.header['location']).end();
//        }
//        else {
//          page.setState(res.body.state);
//          extend(csrf, res.body.csrf);
//        }
//        done();
//      }
//    });
//  },

  end: function(callback) {
    callback = callback || function() {};
    var pageRequest = this;
    var pages = this.pages;

    pages.schedule(this.route, function(page) {
      if (!page) return callback();

      if (page.method === 'POST') pageRequest._write(page, finish);
      else pageRequest._read(page, finish);

      function finish() {
        pages.transition(page);
        callback();
      }
    });
  }
});

module.exports = PageRequest;
