# Pages

A framework for building isomorphic web apps that are wrappers around resource
APIs. Consider this the controller layer, gluing APIs (the model layer) to
the display (view layer) with a keen eye on the holy grail.

Build 'em like they used to, have 'em work like they should.

What you have to do:

- Write isomorphic interfaces to APIs (this is often accomplished via an
  isomorphic HTTP request
  library...ahem...[SuperAgent](http://visionmedia.github.io/superagent/))
- Find or build a html/DOM rendering and diffing
  library...ahem...[ReactJS](http://facebook.github.io/react/)
- Hook them together using Pages.

What you get:

- Server-side rendering/handling of all GET/POST actions.
- Snappy initial page loads.
- AJAX navigation and submission without touching an
  `<a/>` onclick or `<form/>` onsubmit (that's isomorphic).
- Built-in js module bundling and loading (via
  [dynapack](https://github.com/bauerca/dynapack)).


## Installation

```
npm install osh-pages
```

## Usage

Consider the following files

```
server.js
routes.js
view-user.js
```

The contents of each are printed below; let's start with `routes.js`
as it should look the most familiar:

```js
module.exports = {
  'view-user': {
    path: '/users/<username>',
    params: {
      username: /^[a-z]+$/
    }
  }

  // other routes here...

};
```

Each entry in the route map is a config object for an
[osh-route](https://github.com/openscihub/node-osh-route).

The module, `view-user.js` exports a page prototype, which defines
the lifecycle methods for a page.

```js
var request = require('superagent'); // isomorphic!..mostly

module.exports = {
  /**
   *  Read data from various APIs. In this case, we
   *  pull some user data from a fictitious API.
   */
  read: function(pages, done) {
    var page = this;
    request.get('https://api.mysite.com/users/' + this.props.username)
    .end(function(res) {
      page.setState({
        fullname: (
          res.ok ?
          res.body.fullname :
          'Unknown user'
        ),
        title: (
          res.ok ?
          this.props.username :
          'Not found'
        )
      });
      done();
    });
  },

  /**
   *  Not a lifecycle method; separated from renderToString and
   *  renderToDocument for code reuse.
   */
  renderBody: function() {
    return (
      '<h1>' + this.escape(this.state.fullname) + '</h1>'
    );
  },

  /**
   *  Lifecycle method. Render on the server.
   */
  renderToString: function() {
    return (
      '<!DOCTYPE html>' +
        '<head>' +
          '<title>' + this.state.title + '</title>' +
        '</head>' +
        '<body>' +
          this.renderBody() +
          this.renderAjax() +
        '</body>' +
      '</html>'
    );
  },

  /**
   *  Lifecycle method. Render on the browser. Use a DOM renderer
   *  with diffing, like ReactJS, rather than what is done here.
   */
  renderToDocument: function() {
    document.body.innerHTML = this.renderBody();
    document.title = this.state.title;
  },

  /**
   *  Lifecycle method. Enhance HTML with js in the browser.
   */
  run: function() {
    // Initialize onclick handlers and other goodies.
  }
};
```

Finally, you serve the app using Express, and optionally use the built-in
bundler (based on [dynapack](https://github.com/bauerca/dynapack)) to
enable client-side AJAX rendering and navigation. The following is
`server.js`:

```js
var express = require('express');
var serveStatic = require('serve-static');
var Pages = require('osh-pages');

var app = express();

var pages = Pages({basedir: __dirname});

// Paths are relative to basedir
pages.routes('./routes');
pages.set('view-user', './view-user');
pages.bundle({
  output: './bundles',
  prefix: '/js/'
});

app.use(pages);
app.use('/js', serveStatic(__dirname + '/bundles'));

pages.on('bundled', function() {
  app.listen(3333);
});
```

## Documentation

### Pages(opts)

- options
  - `basedir`: All configuration parameters that are specified as
    relative paths are assumed relative to this directory.
    - default: `process.cwd()`
    - required: yes
    - type: `String`
  - `routes`: See documentation for [routes()](#pagesroutesname-page).

Call this to create a new pages instance on the server; it returns
an express middleware function augmented with the following
setup methods.

#### pages.routes(path)

- `path`: Path to a module that exports a routes object; the sitemap.
  Can be relative to `basedir` set in constructor.
  - required: yes
  - type: String

Example routes.js:

```js
module.exports = {
  'user': {
    path: '/users/<username>',
    params: {
      username: /^[a-z]+$/
    }
  },
  'article': {
    path: '/articles/<articleId>',
    params: {
      articleId: /^\w+$/
    }
  }
};
```

#### pages.set(name, page)

- `name`: The name of a route exported by the routes module given to
  [routes()](#pagesroutespath).
  - type: String
  - required: yes
- `page`: Path to a module that exports a [Page](#page) prototype. Can
  be relative to `basedir` set in constructor.
  - type: String
  - required: yes

Register page logic with a route. You need to register by way of a module
path so that Pages can bundle your javascript.

#### pages.fn(name, fn)

- `name`: The name of the server function.
- `fn`: The server function.
  - Signature: `fn(opts, done)` where `opts` is POJO data and `done` is
    a callback. Pass error and result as first and second arg, respectively,
    to `done`.

Register a server function (or remote procedure) with the Pages instance.  A
server function is callable within a [Page's](#page) read/write methods and
runs on only the server (when called in the browser, an AJAX request handles
the function call for you, being careful to send and check a CSRF token
for security).

Use server functions when a task needs to be performed privately, like
authenticating with an OAuth2-capable API server.

Within the server function, `this` has the following properties:

- `this.session`: The current [Session](#session) instance.

Example:

```js
pages.fn('refreshAccessToken', function(opts, done) {
  request.post('https://api.api.api/oauth/token')
  .auth('thewebs', 'sshh')
  .send({
    grant_type: 'refresh_token',
    refresh_token: 'badf00d'
  })
  .end(function(err, res) {
    if (err) done(err);
    else {
      done(null, res.body.access_token);
    }
  });
});
```

#### pages.bundle(opts)

- options
  - `output`: Output directory for bundles. Can be relative to basedir.
    - type: String
    - default: `'/bundles'`
  - `prefix`: Prefix for script urls. If serving scripts from the same
    express app that houses the pages instance, this value should match
    the mount path (with a trailing slash).

Bundle up javascript using [Dynapack](https://github.com/bauerca/dynapack).
Options are passed to Dynapack after resolving any relative paths.

When bundling has finished, the `'bundled'` event is fired on the pages
instance.

Example:

```js
pages.bundle({
  output: __dirname + '/bundles',
  prefix: '/js/'
});

app.use(pages);
app.use('/js', serveStatic(__dirname + '/bundles'));

pages.on('bundled', function() {
  app.listen(3333);
});
```


## Page

A Page prototype registered with the [pages.set()](#pagessetnamepage) method
should implement the following API. Lifecycle methods are required to do
anything useful.

### Lifecycle methods

These methods should be defined on a Page prototype. Just remember,
read/write/render/run/fun/profit/glory/gratitude/humility (that got out of
hand...).

#### read(pages, render)

Called on a GET request for the Page.

Using information in `this.props` and the given `pages` object, gather data
from APIs and make calls to `this.setState(state)` to prepare the page for
rendering. Call the `render` callback without arguments when ready to render
the page.

The `pages` object contains the following properties to help with optimization
and managing session state:

- `pages.session`: The current [Session](#session) instance.
- `pages.current`: The currently rendered page. If you are not managing your
  own caching, use this to migrate state from the old page to the
  new page without requerying an API. The only properties available are:
  - `pages.current.name`
  - `pages.current.props`
  - `pages.current.state`

It also houses every server function registered with
[pages.fn()](#pagesfnname-fn).

The `render` callback doubles as a redirector; passing it either a URI or a
name/props pair will skip rendering of the current page and either send a 302
response (if running on the server) or begin an AJAX GET of the indicated page
(if running in the browser). For example, if there was an error fetching data
from an API, you can redirect to a not-found page via:

```js
module.exports = {
  read: function(pages, render) {
    var page = this;
    var session = pages.session;
    var current = pages.current;

    if (current && current.props.username === 'beatrix') {
      this.setState({
        user: current.state.user
      });
      render();
    }
    else {
      api.getUser('beatrix', function(err, user) {
        if (err) {
          render('404', {msg: err.message});
          // Assuming the '404' route path is simply: '/not-found', the
          // following would be equivalent:
          //render('/not-found?msg=' + encodeURIComponent(err.message));
        }
        else {
          page.setState({user: user});
          render();
        }
      });
    }
  }

  // ...
};
```

where `'404'` is the name of a route.

#### write(pages, redirect)

Called when the page is POSTed to. This method stands alone; render
methods are not called after write, because pages should not be returned from
POST requests, only redirects (see [this wonderful treatise on the
topic](http://www.theserverside.com/news/1365146/Redirect-After-Post)). It is
possible to have a page prototype that consists only of a write method (do
this to create a route that serves only POST requests).

The `pages` object contains the following properties to help with
managing session state:

- `pages.session`: The current [Session](#session) instance.

It also houses every server function registered with
[pages.fn()](#pagesfnname-fn).

Inside the write method, `this.payload` is used to access the data that was
POSTed from the form. Standard urlencoded forms will result in a simple
`this.payload` object, where keys are form input names. For example, submission
of the form:

```html
<form>
  <input name="greeting" type="text" value="hello"/>
  <input type="submit"/>
</form>
```

would result in a payload object (shown as json):

```js
{
  "greeting": "hello"
}
```

If the form encoding was `multipart/form-data` (for
file uploads), then the `this.payload` object will be a readable stream which
can be piped to a superagent request to some API. If not piping, the payload
can be split up by listening for `'field'` events (`this.payload` is also an
event emitter in this case).

The given redirect method should be called with a name and props object
like,

```js
redirect('view-user', {username: 'tory'});
```

or with a uri

```js
redirect('/users/tory');
```

In the following contrived example, the write method is enacting a POST
request that will attempt to change the full name of a user:

```js
var Page = module.exports = {
  // ...

  write: function(session, redirect) {
    request.post('https://api.mysite.com/users/' + session.state.username)
    .set('x-api-key', session.state.apiKey)
    .send({
      fullname: this.payload.fullname
    })
    .end(function(res) {
      if (res.ok) {
        redirect('view-user', {
          username: session.state.username
        });
      }
      else {
        redirect('update-user-form', {
          // Some error message from the API server:
          msg: res.body.message
        });
      }
    });
  }
};
```

#### renderToString(pages)

Called on the server for initial renders (subsequent page visits in the
session are rendered on the client using renderToDocument). This should
return the entire page html, including `<!DOCTYPE html>`, `<head>`, and
whatnot.

The `pages` object passed to this method has the following
properties:

- `pages.csrf`: Properties required by osh-pages when submitting forms
  to protect against cross-site request forgeries. The following strings
  should be set as attributes on a hidden `<input>` element that appears
  *first* in any `<form>` groups. Each property name matches the `<input>`
  attribute name on which it should be set.
  - `pages.csrf.name`: Field name recognized by osh-pages.
  - `pages.csrf.value`: The csrf token.
- `pages.uri(name, props)`: Get a URI from route name/props pairs for creating
  links.

It is common to define methods on your Page prototype that will be shared
between renderToString and renderToDocument to keep your code DRY
(e.g. renderBody, renderTitle, etc.).

Example:

```js
module.exports = {
  // ...

  renderToString: function() {
    return (
      '<!DOCTYPE html>' +
        '<head>' +
          this.escape(this.renderTitle()) +
        '</head>' +
        '<body>' +
          this.renderBody() +
          this.renderAjax() +
        '</body>'
      '</html>'
    );
  }
};
```

#### render(pages)

Update the document to show the current page. A very basic implementation
(that would defeat the purpose of AJAX navigation) might be:

```js
module.exports = {
  // ...

  renderBody: function(pages) {
    return 'so much html...';
  },

  render: function(pages) {
    document.body.innerHTML = this.renderBody(pages);
    document.title = this.renderTitle();
  }
};
```

A more performant version would find the smallest difference between the
currently rendered page and the page to render, and update only those elements
of the document that need it. ReactJS provides automatic DOM diffing and is a
good choice here (in fact, this library was built with React rendering in
mind); in principle, any DOM diffing/rendering tool would work here.

Event handlers *should not* be attached to the document in this step. Instead
they *should* be attached in the run() lifecycle method, which gets called both
on initial page load and after each AJAX render. In general, it is okay to push
rendering into the run method (at the risk of re-rendering your initial page),
but not okay to push progressive enhancement into the render method.

*Note: In the case of a view library like React, which provides rendering and
progressive enhancement, simply defer rendering to run() (although
setting some DOM, like document.title, might be more appropriate for
render()). Up to you.*

#### recoverState(pages)

If stashing was disabled in [Page.read()](#readpagesrender), the state that
was not stashed should be recovered from the server-rendered HTML in this
method. This is called once per browser session, on initial page load.

For example, an API might return a large chunk of raw HTML. Rather than
use the automatic Pages stashing and recovery, it would be more efficient
to read the HTML from the document on initial page load.

Example:

```js
module.exports = {
  read: function(pages, render) {
    var page = this;
  
    // Important... see this later in the docs. Turns off all
    // stashing.
    page.stash(false);
  
    request.get('https://api.blog.com/posts/42')
    .end(function(res) {
      page.setState({
        blogPost: res.body
      });
      render();
    });
  },

  renderToString: function(pages) {
    return: (
      '<div id="post">' + this.state.blogPost + '</div>'
    );
  },

  recoverState: function(pages) {
    this.setState({
      blogPost: document.getElementById('post').innerHTML
    });
  },

  run: function(pages) {
    // and we have it...
    console.log(this.state.blogPost);
  }
};
```

#### run(pages)

Attach event handlers to the DOM. Or use a view library (like ReactJS) that
handles progressive enhancement, DOM diffing/rendering, and event handling.

### Instance methods

These methods are used from within the lifecycle methods described above.

#### setState(state)

Call this in [Page.read()](#readpagesrender) to set downloaded state on
the page instance.

#### stash(boolean)

Toggle stashing of state set with [setState()](#setstatestate). By default,
stashing is turned on, so that all the state set in a Page's read lifecycle
method is available in the browser on initial page load (without the need for
requerying APIs).

#### renderAjax()

Call this in renderToString to enable AJAX/progressive enhancement.  It
includes `<script>` elements for the javascript bundles generated by Dynapack
and a `<span>` for transporting state that was stashed in a Page's read method
for reuse in the browser.

#### privately(fnName, callback)

If session secrets need to be read or written, define a prototype method

```js
{
  refreshApiKey: function(pages, done) {
    var session = pages.session;

    request.post('https://api.mysite.com/oauth2/token')
    .type('form')
    .send({
      grant_type: 'refresh_token',
      refresh_token: session.secrets.refreshToken
    })
    .end(function(res) {
      if (!res.ok) done(res.error);
      else {
        var expires = Date.now();
        expires.setSeconds(expires.getSeconds() + res.body.expires_in);
        session.setState({
          apiKey: res.body.access_token,
          apiKeyExpires: expires.getTime()
        });
        session.setSecrets({
          refreshToken: res.body.refresh_token
        });
        done();
      }
    });
  },

  read: function(pages, render) {
    if (pages.session.state.apiKey.expires < Date.now()) {
      this.privately('refreshApiKey', function() {
        if (pages.session.state.apiKey.expires < Date.now()) {
          // something failed server side.
        }
      });
    }

  }
}
```


## Session

This is passed in to the read/write lifecycle methods.

### Pages reference

This is the object that is passed in to a Page's lifecycle methods.

#### csrf

#### session

A function used for setting session state which doubles as a container for
the existing session state. For example,

```js
read: function(pages, render) {
  // Set session state
  pages.session({username: 'tory'});

  // Get session state
  pages.session.username; // 'tory'

  // ...
}
```

#### secrets

### properties

All available on `this`.

- props
- state
- csrf
- request

### name

The string label given to the page at registration.

### pages

This is a reference to the Pages instance in which it
was registered. Use this for navigation in the browser (by calling


A Page consists of props, data, and display. Props identify the page,
data is a display-neutral representation of the page, and display takes
the props and data and generates/modifies html.

Props are used to

- Build urls
- Submit data requests
- Fetch display logic

A set of props uniquely defines a webpage.
