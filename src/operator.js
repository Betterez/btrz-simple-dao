"use strict";

let InnerCursor =  require("./inner-cursor").InnerCursor,
  ObjectID = require("mongodb").ObjectID,
  utils = require("./utils");

class Operator {
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
    try {
      if (typeof id === "string") {
        id = new ObjectID(id);
      }
    } catch (err) {
      throw err;
    }
    return this.findOne({_id: id});
  }

  update(query, update, options) {
    if (!query) {
      throw new Error("query can't be undefined or null");
    }
    if (!update) {
      throw new Error("update can't be undefined or null");
    }

    if (!options) {
      return this.collection.update(query, update);
    }
    return this.collection.update(query, update, options);
  }

  removeById(id, options) {
    if (typeof id === "string") {
      id = new ObjectID(id);
    }
    return this.collection.remove({_id: id}, options);
  }

  distinct(field, query){
    return this.collection.distinct(field || "", query || {});
  }
}

exports.Operator = Operator;
