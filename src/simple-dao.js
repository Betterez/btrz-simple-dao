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
  let connectionString = "mongodb://";

  if (dbConfig.options.username.length > 0) {
    connectionString += `${encodeURIComponent(dbConfig.options.username)}:${encodeURIComponent(dbConfig.options.password)}@`;
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
const mongoClients = {};


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

  async _getMongoClient() {
    const existingClient = mongoClients[this.connectionString];

    if (existingClient) {
      return existingClient;
    }

    const connectionStringWithoutCredentials = this.connectionString.split("@").length > 1 ?
      this.connectionString.split("@")[1] : this.connectionString.split("@")[0];
    this.logInfo(`Connecting to Mongo server(s): ${connectionStringWithoutCredentials}`);

    try {
      mongoClients[this.connectionString] = MongoClient.connect(this.connectionString);
      const client = await mongoClients[this.connectionString];

      client.on("close", (err) => {
        Reflect.deleteProperty(mongoClients, this.connectionString);
        this.logError("Connection to Mongo unexpectedly closed", err);
      });

      this.logInfo(`Connected to Mongo server(s): ${connectionStringWithoutCredentials}`);
      return client;
    } catch (err) {
      Reflect.deleteProperty(mongoClients, this.connectionString);
      this.logError("Failed to connect to Mongo", err);
      throw err;
    }
  }

  async connect() {
    const client = await this._getMongoClient(this.connectionString);
    // Use the database specified in the connection string
    const db = client.db();
    db.gridfs = () => this.gridfs(db);
    return db;
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

  async collectionNames() {
    const db = await this.connect();
    const collections = await db.listCollections().toArray();
    return collections.map(collection => collection.name);
  }

  async dropCollection(collectionName) {
    try {
      const db = await this.connect();
      return db.dropCollection(collectionName);
    } catch (err) {
      this.logError(`SimpleDao: Error dropping collection '${collectionName}'`, err);
      throw err;
    }
  }

  async aggregate(collectionName, query) {
    try {
      const db = await this.connect();
      return db
        .collection(collectionName)
        .aggregate(query,
          {
            allowDiskUse: true,
            cursor: {batchSize: 1000}
          });
    } catch (err) {
      this.logError("SimpleDao: Error performing aggregate query", err);
      throw err;
    }
  }

  async save(model) {
    if (!model) {
      throw new Error("SimpleDao: No data was provided in the call to .save()");
    }

    if (model.updatedAt && model.updatedAt.value) {
      model.updatedAt.value = new Date();
    }

    const collectionName = getCollectionName(model.constructor);

    try {
      const db = await this.connect();
      const result = await db.collection(collectionName)
        .save(model);

      if (!model._id) {
        model._id = result.result.upserted[0]._id;
      }

      return model;
    } catch (err) {
      this.logError("SimpleDao: Error performing save", err);
      throw err;
    }
  }
}

module.exports = {
  SimpleDao,
  getConnectionString
};
