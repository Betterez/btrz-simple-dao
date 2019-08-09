const InnerCursor = require("./inner-cursor").InnerCursor;
const ObjectID = require("mongodb").ObjectID;
const utils = require("./utils");


function promisedCursor(collection, query, options) {
  return new Promise(((resolve, reject) => {
    collection.find(query, options || {}, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  }));
}


class Operator {
  constructor(simpleDao, collectionName, factory) {
    this.simpleDao = simpleDao;
    this.collectionName = collectionName;
    this.factory = factory;
  }

  async count(query) {
    try {
      const db = await this.simpleDao.connect();
      return db.collection(this.collectionName).count(query);
    } catch (err) {
      this.simpleDao.logError("SimpleDao: Error performing count", err);
      throw err;
    }
  }

  find(query, options) {
    const cursor = this
      .simpleDao
      .connect()
      .then((db) => {
        const collection = db.collection(this.collectionName);
        return promisedCursor(collection, query, options || {});
      })
      .catch((err) => {
        this.simpleDao.logError("operator find", err);
        throw err;
      });
    return new InnerCursor(cursor, this.factory);
  }

  findOne(query) {
    const factory = this.factory;
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

  findAggregate(query) {
    const cursorPromised = this.simpleDao.aggregate(this.collectionName, query);
    return new InnerCursor(cursorPromised, this.factory);
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
        const collection = db.collection(this.collectionName);
        return collection.update(query, update, options || {})
          .then((result) => {
            const endResult = result.result;
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

  remove(query) {
    if (!query) {
      throw new Error("query can't be undefined or null");
    }
    return this
      .simpleDao
      .connect()
      .then((db) => {
        const collection = db.collection(this.collectionName);
        return collection.remove(query);
      })
      .then((result) => {
        return result.result;
      })
      .catch((err) => {
        this.simpleDao.logError("operator remove", err);
        throw err;
      });
  }

  removeById(id, options) {
    if (typeof id === "string") {
      id = new ObjectID(id);
    }
    return this.remove({_id: id});
  }

  distinct(field, query) {
    return this
      .simpleDao
      .connect()
      .then((db) => {
        const collection = db.collection(this.collectionName);
        return collection.distinct(field || "", query || {});
      })
      .catch((err) => {
        this.simpleDao.logError("operator removeById connect", err);
        throw err;
      });
  }
}

exports.Operator = Operator;
