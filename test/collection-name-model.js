"use strict";
let uuid = require("uuid");

class CollectionNameModel {
  constructor () {
    this._id = uuid.v1();
    this.name = "some name";
  }

  static collectionName() {
    return "a_simple_collection";
  }

  static factory(literal) {
    let cn = new CollectionNameModel();
    cn._id = literal._id;
    cn.name = literal.name;
    return cn;
  }
}

exports.CollectionNameModel = CollectionNameModel;
