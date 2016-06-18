if (typeof DB == 'undefined') {
  DB = require('../lib');
}

var helper = {
  rootTokenStorage: null,
  makeLogin: function() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 10; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    return 'user-' + text;
  },
  randomize: function(name) {
    var rnd = Math.floor(Math.random() * 1000000);
    return name + "_random_" + rnd;
  },
  sleep: function(time, value) {
    return new Promise(function(success) {
      setTimeout(function() {
        success(value);
      }, time);
    });
  },
  asset: function(src) {
    return helper.req("/spec/assets/" + src);
  },
  req: function(url) {
    return new Promise(function(resolve, reject) {
      var oReq = new XMLHttpRequest();
      oReq.open("GET", url, true);
      oReq.responseType = "blob";
      oReq.onload = function() {
        if (oReq.status >= 400) {
          reject({status: oReq.status});
        } else {
          resolve(oReq.response);
        }
      };
      oReq.onerror = reject;
      oReq.send()
    });
  }
};

before(function() {
  var emf = new DB.EntityManagerFactory(env.TEST_SERVER);
  return emf.createEntityManager().ready().then(function(em) {
    return em.User.login('root', 'root').then(function() {
      helper.rootTokenStorage = em.tokenStorage;
    });
  });
});

if (typeof module != 'undefined') {
  module.exports = helper;
}

