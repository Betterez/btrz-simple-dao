"use strict";

let MongoClient = require("mongodb").MongoClient,
  ObjectID = require("mongodb").ObjectID,
  GridStore = require('mongodb').GridStore,
  Operator = require("./operator").Operator;

function getConnectionString(dbConfig) {
  const dbHostUris = dbConfig.uris.join(",");
  let credentials = "";

  if (dbConfig.options.username.length > 0) {
    credentials = `${dbConfig.options.username}:${dbConfig.options.password}@`;
  }

  return `${credentials}${dbHostUris}/${dbConfig.options.database}`;
}

function getCollectionName(ctrFunc) {
  let collectionName = ctrFunc.name.toLowerCase();
  if (ctrFunc.collectionName) {
    collectionName = ctrFunc.collectionName();
  }
  return collectionName;
}

// A collection of all connections to the DB, keyed by the connection string that was used to connect
const dbConnections = {};


class SimpleDao {

  static objectId(id) {
    if (id) {
      return new ObjectID(id);
    }
    return new ObjectID();
  }

  constructor(options, logger) {
    this.connectionString = getConnectionString(options.db);
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
    } else {
      console.log(msg);
    }
  }

  async connect() {
    const existingConnection = dbConnections[this.connectionString];

    if (existingConnection) {
      return existingConnection;
    }

    this.logInfo("Connecting to Mongo...");

    try {
      dbConnections[this.connectionString] = await MongoClient.connect(`mongodb://${this.connectionString}`);
      const db = dbConnections[this.connectionString];

      this.logInfo("Connected to Mongo");

      db.on("close", (err) => {
        Reflect.deleteProperty(dbConnections, this.connectionString);
        this.logError("Connection to Mongo unexpectedly closed", err);
      });

      db.gridfs = () => this.gridfs(db);
      return db;
    } catch (err) {
      Reflect.deleteProperty(dbConnections, this.connectionString);
      this.logError("Failed to connect to Mongo", err);
      throw err;
    }
  }

  // this exists for compatibility with the soon-to-be-removed mongoskin API
  gridfs(db) {
    return {
      open: (fileName, readWriteFlag, callback) => {
        const store = new GridStore(db, fileName, readWriteFlag);
        store.open((error, gs) => {
          callback(error, gs);
        });
      },
    };
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
    return this
      .connect()
        .then((db) => {
          return db
            .collection(collectionName)
            .aggregate(query,
                {
                  allowDiskUse: true,
                  cursor: {batchSize: 1000}
              });
        })
        .catch((err) => {
          this.logError("aggregate error connect", err);
          throw err;
        });
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

module.exports = {
  SimpleDao
};
