"use strict";

var InnerCursor =  require("./inner-cursor").InnerCursor,
  utils = require("./utils");

class Finder {
  constructor(collection, factory) {
    this.collection = collection;
    this.factory = factory;
  }

  find(query, options) {
    let cursor;
    if (!options) {
      cursor = this.collection.find(query);
    } else {
      cursor = this.collection.find(query, options);
    }
    return new InnerCursor(cursor, this.factory);
  }

  findOne(query) {
    let factory = this.factory;
    return this.collection.findOne(query).then(function (model) {
      return model ? utils.buildModel(factory)(model) : model;
    });
  }

  findById(id) {
    return this.findOne({_id: id});
  }
}

exports.Finder = Finder;
