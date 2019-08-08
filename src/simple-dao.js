

const assert = require("assert");
const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectID;
const GridStore = require("mongodb").GridStore;
const Operator = require("./operator").Operator;

const {DEFAULT_AUTH_MECHANISM, ALL_AUTH_MECHANISMS, ALL_READ_PREFERENCES} = require("../constants");


function getReadPreference(dbConfig) {
  const readPreference = dbConfig.options.readPreference;

  if (!readPreference) {
    return null;
  }

  assert(ALL_READ_PREFERENCES.includes(readPreference),
    `When specified, database config 'readPreference' must be one of ${ALL_READ_PREFERENCES.join(", ")}`);
  return readPreference;
}

function getAuthMechanism(dbConfig) {
  const authMechanism = dbConfig.options.authMechanism;

  if (!authMechanism) {
    return DEFAULT_AUTH_MECHANISM;
  }

  assert(ALL_AUTH_MECHANISMS.includes(authMechanism), `Database config 'authMechanism' must be one of ${ALL_AUTH_MECHANISMS.join(", ")}`);
  return authMechanism;
}

function getConnectionString(dbConfig) {
  let connectionString = "";

  if (dbConfig.options.username.length > 0) {
    connectionString += `${dbConfig.options.username}:${dbConfig.options.password}@`;
  }

  const dbHostUris = dbConfig.uris.join(",");
  connectionString += dbHostUris;
  connectionString += `/${dbConfig.options.database}`;

  const authMechanism = getAuthMechanism(dbConfig);
  connectionString += `?authMechanism=${authMechanism}`;

  const readPreference = getReadPreference(dbConfig);
  if (readPreference) {
    connectionString += `&readPreference=${readPreference}`;
  }

  const replicaSet = dbConfig.options.replicaSet;
  if (replicaSet) {
    connectionString += `&replicaSet=${replicaSet}`;
  }

  return connectionString;
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

  static objectId(id) {
    if (id) {
      return new ObjectID(id);
    }
    return new ObjectID();
  }

  objectId(id) {
    return SimpleDao.objectId(id);
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

      db.gridfs = () => { return this.gridfs(db); };
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
      }
    };
  }

  for(ctrFunc) {
    if (!ctrFunc.factory) {
      throw new Error("SimpleDao: The provided constructor function or class needs to have a factory function");
    }
    const collectionName = getCollectionName(ctrFunc);
    return new Operator(this, collectionName, ctrFunc.factory);
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
  SimpleDao,
  getConnectionString
};
