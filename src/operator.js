"use strict";

let InnerCursor =  require("./inner-cursor").InnerCursor,
  ObjectID = require("mongodb").ObjectID,
  utils = require("./utils");

function promisedCursor(collection, query, options) {
  return new Promise(function (resolve, reject) {
    collection.find(query, options || {}, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

class Operator {
  constructor(simpleDao, collectionName, factory) {
    this.simpleDao = simpleDao;
    this.collectionName = collectionName;
    this.factory = factory;
  }

  find(query, options) {
    let cursor = this
        .simpleDao
        .connect()
        .then((db) => {
          let collection = db.collection(this.collectionName);
          return promisedCursor(collection, query, options || {});
        })
        .catch((err) => {
          this.simpleDao.logError("operator find", err);
          throw err;
        });
    return new InnerCursor(cursor, this.factory);
  }

  findOne(query) {
    let factory = this.factory;
    return this
      .simpleDao
      .connect()
      .then((db) => {
        return db
          .collection(this.collectionName)
          .findOne(query)
          .then((model) => {
            return model ? utils.buildModel(factory)(model) : model;
          });
      })
      .catch((err) => {
        this.simpleDao.logError("operator findOne", err);
        throw err;
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

    return this
      .simpleDao
      .connect()
      .then((db) => {
        let collection = db.collection(this.collectionName);
        return collection.update(query, update, options || {})
          .then((result) => {
            let endResult = result.result;
            endResult.updatedExisting = endResult.nModified > 0;
            return endResult;
          })
          .catch((err) => {
            this.simpleDao.logError("operator update", err);
            throw err;
          });
      })
      .catch((err) => {
        this.simpleDao.logError("operator update connect", err);
        throw err;
      });
  }

  removeById(id, options) {
    if (typeof id === "string") {
      id = new ObjectID(id);
    }
    return this
      .simpleDao
      .connect()
      .then((db) => {
        let collection = db.collection(this.collectionName);
        return collection.remove({_id: id}, options)
          .then((result) => {
            return result.result;
          })
          .catch((err) => {
            this.simpleDao.logError("operator remove", err);
            throw err;
          });
      })
      .catch((err) => {
        this.simpleDao.logError("operator removeById connect", err);
        throw err;
      });
  }

  distinct(field, query){
    return this
      .simpleDao
      .connect()
      .then((db) => {
        let collection = db.collection(this.collectionName);
        return collection.distinct(field || "", query || {});
      })
      .catch((err) => {
        this.simpleDao.logError("operator removeById connect", err);
        throw err;
      });
  }
}

exports.Operator = Operator;
