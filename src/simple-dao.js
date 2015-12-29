"use strict";

let pmongo = require("promised-mongo"),
  MongoClient = require("mongodb").MongoClient,
  ObjectID = require("mongodb").ObjectID,
  Operator = require("./operator").Operator;

function connectionString(dbConfig) {
  var uris = dbConfig.uris.join(",");
  if (dbConfig.options.username.length > 0) {
    return `${dbConfig.options.username}:${dbConfig.options.password}@${uris}/${dbConfig.options.database}`;
  }
  return `${uris}/${dbConfig.options.database}`;
}

function getCollectionName(ctrFunc) {
  let collectionName = ctrFunc.name.toLowerCase();
  if (ctrFunc.collectionName) {
    collectionName = ctrFunc.collectionName();
  }
  return collectionName;
}

class SimpleDao {

  static objectId(id) {
    if (id) {
      return new ObjectID(id);
    }
    return new ObjectID();
  }

  constructor(options, _mongoDriver_) {
    this.connectionString = connectionString(options.db);
    this.db = _mongoDriver_ || pmongo(this.connectionString);
  }

  objectId(id) {
    return SimpleDao.objectId(id);
  }

  aggregate(collectionName, query) {
    var self = this;
    function resolver(resolve, reject) {
      MongoClient.connect(`mongodb://${self.connectionString}`, function (err, db) {
        if (err) {
          return reject(err);
        }
        var cursor = db
          .collection(collectionName)
          .aggregate(query,
              {
                allowDiskUsage: true,
                cursor: {batchSize: 1000}
            });
        resolve(cursor);
      });
    }
    return new Promise(resolver);
  }

  for(ctrFunc) {
    if (!ctrFunc.factory) {
      throw new Error("The Ctr provided needs to have a factory function");
    }
    let collectionName = getCollectionName(ctrFunc);
    let collection = this.db.collection(collectionName);
    return new Operator(collection, ctrFunc.factory);
  }

  save(model) {
    if (!model) {
      throw new Error("model can't be undefined or null");
    }
    let collectionName = getCollectionName(model.constructor);
    return this.db.collection(collectionName).save(model);
  }
}

exports.SimpleDao = SimpleDao;
