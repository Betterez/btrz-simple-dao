const InnerCursor = require("./inner-cursor").InnerCursor;
const ObjectID = require("mongodb").ObjectID;
const {
  resolveUserId,
  scalarAccountId,
  resolveTargets,
  recordUpdates,
  recordDeletes,
  throwIfStrictMissing
} = require("./audit");

class Operator {
  constructor(simpleDao, collectionName, factory) {
    this.simpleDao = simpleDao;
    this.collectionName = collectionName;
    this.factory = factory;
  }

  static cleanOptions(options) {
    if (!options) {
      return {};
    }
    if (options.w) {
      delete options.w;
    }
    return options;
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

  find(query, options = {}) {
    const cursor = this
      .simpleDao
      .connect()
      .then((db) => {
        return db.collection(this.collectionName).find(query, options);
      })
      .catch((err) => {
        this.simpleDao.logError("SimpleDao: Error performing find", err);
        throw err;
      });

    return new InnerCursor(cursor, this.factory);
  }

  async findOne(query, options = {}) {
    try {
      const db = await this.simpleDao.connect();
      const model = await db.collection(this.collectionName).findOne(query, options);
      return model && this.factory(model);
    } catch (err) {
      this.simpleDao.logError("SimpleDao: Error performing findOne", err);
      throw err;
    }
  }

  async findById(id, options = {}) {
    let _id = id;

    if (typeof id === "string") {
      _id = new ObjectID(id);
    }

    return this.findOne({_id}, options);
  }

  findAggregate(query) {
    const cursorPromised = this.simpleDao.aggregate(this.collectionName, query);
    return new InnerCursor(cursorPromised, this.factory);
  }

  async update(query, update, options, userId) {
    if (!query) {
      throw new Error("query can't be undefined or null");
    }
    if (!update) {
      throw new Error("update can't be undefined or null");
    }

    try {
      const db = await this.simpleDao.connect();
      const collection = db.collection(this.collectionName);
      const auditor = this.simpleDao.auditor;
      let resolvedUserId = undefined;
      let targets = [];
      if (auditor) {
        resolvedUserId = resolveUserId({update, explicitUserId: userId});
        const accountIdHint = scalarAccountId(update && update.$set) || scalarAccountId(query);
        targets = await resolveTargets(collection, query, {accountIdHint});
        if (!options || options.multi !== true) {
          targets = targets.slice(0, 1);
        }
        throwIfStrictMissing(auditor, resolvedUserId, targets);
      }
      const result = await collection.update(query, update, Operator.cleanOptions(options));
      const endResult = result.result;
      endResult.updatedExisting = endResult.nModified > 0;
      if (auditor) {
        recordUpdates(auditor, {
          targets,
          collectionName: this.collectionName,
          userId: resolvedUserId,
          query,
          payload: update
        });
      }
      return endResult;
    } catch (err) {
      this.simpleDao.logError("SimpleDao: Error performing update", err);
      throw err;
    }
  }

  async remove(query, userId) {
    if (!query) {
      throw new Error("query can't be undefined or null");
    }

    try {
      const db = await this.simpleDao.connect();
      const collection = db.collection(this.collectionName);
      const auditor = this.simpleDao.auditor;
      let resolvedUserId = undefined;
      let targets = [];
      if (auditor) {
        resolvedUserId = resolveUserId({explicitUserId: userId});
        targets = await resolveTargets(collection, query, {accountIdHint: scalarAccountId(query)});
        throwIfStrictMissing(auditor, resolvedUserId, targets);
      }
      const result = await collection.remove(query);
      if (auditor) {
        recordDeletes(auditor, {
          targets,
          collectionName: this.collectionName,
          userId: resolvedUserId,
          query
        });
      }
      return result.result;
    } catch (err) {
      this.simpleDao.logError("SimpleDao: Error performing remove", err);
      throw err;
    }
  }

  async removeById(id, userId) {
    let _id = id;

    if (typeof id === "string") {
      _id = new ObjectID(id);
    }

    return this.remove({_id}, userId);
  }

  async distinct(field, query) {
    try {
      const db = await this.simpleDao.connect();
      const collection = db.collection(this.collectionName);
      const result = await collection.distinct(field || "", query || {});
      return result;
    } catch (err) {
      if (err.code === 40352) {
        return [];
      }
      this.simpleDao.logError("SimpleDao: Error performing distinct", err);
      throw err;
    }
  }
}

exports.Operator = Operator;
