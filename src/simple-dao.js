"use strict";

let MongoClient = require("mongodb").MongoClient,
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

  constructor(options, logger) {
    this.connectionString = connectionString(options.db);
    this.logger = logger;
  }

  logError(msg, err) {
    if (this.logger) {
      this.logger.error(msg, err);
    }
  }

  logInfo(msg) {
    if (this.logger) {
      this.logger.info(msg);
    }
  }

  connect() {
    var self = this;
    if (!this.db) {
      this.logInfo("connecting");
      this.db = MongoClient.connect(`mongodb://${this.connectionString}`)
        .then((db) => {
          console.log("adding listener");
          db.on("close", function (err) {
            self.db = null;
            self.logError("connect on close", err);
          });
          return db;
        })
        .catch(function (err) {
          self.db = null;
          self.logError("connect() promise error", err);
          throw err;
        });
    }
    return this.db;
  }

  collectionNames(cb) {
    this.connect()
      .then((db) => {
        db.collection("btrz_connected").find({}).toArray(cb);
      })
      .catch((err) => {
        cb(err, null);
      });
  }

  dropCollection(collectionName) {
    return this
      .connect()
      .then((db) => {
        return db.dropCollection(collectionName);
      })
      .catch((err) => {
        this.logError("dropCollection error connect", err);
        throw err;
      });
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
                allowDiskUse: true,
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
    return new Operator(this, collectionName, ctrFunc.factory);
  }

  save(model) {
    if (!model) {
      throw new Error("model can't be undefined or null");
    }
    if (model.updatedAt && model.updatedAt.value) {
      model.updatedAt.value = new Date();
    }

    const collectionName = getCollectionName(model.constructor);
    return this
      .connect()
      .then((db) => {
        return db
          .collection(collectionName)
          .save(model)
          .then((result) => {
            if (!model._id) {
              model._id = result.result.upserted[0]._id;
            }
            return model;
          })
          .catch((err) => {
            this.logError("saving error", err);
            throw err;
          });
      })
      .catch((err) => {
        this.logError("save error", err);
        throw err;
      });
  }
}

exports.SimpleDao = SimpleDao;
