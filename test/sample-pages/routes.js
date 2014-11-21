module.exports = {
  user: {
    path: '/users/<username>',
    params: {
      username: /^\w+$/
    }
  },
  article: {
    path: '/articles/<article>',
    params: {
      article: /^\w+$/
    }
  },
  redirector: {
    method: 'GET',
    path: '/redirector'
  }
};
