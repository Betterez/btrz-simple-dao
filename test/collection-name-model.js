"use strict";
let ObjectID = require("mongodb").ObjectID;

class CollectionNameModel {
  constructor () {
    this._id = new ObjectID();
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
