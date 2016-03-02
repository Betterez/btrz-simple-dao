"use strict";

let SimpleDao = require("./index").SimpleDao,
  config = {
      db: {
      options: {
          database: "simple_dao_test",
          username: "",
          password: ""
        },
        uris: ["127.0.0.1:27017"]
      }
    },
    dao = new SimpleDao(config);

  function run() {
    setInterval(function () {
      try {
        dao.db.collection("reconnections")
          .find({}, function (err, results) {
            console.log(err, results);
          });
      } catch(e) {
        console.log(e);
      }
    }, 500);
  }

  run();