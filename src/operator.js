const InnerCursor = require("./inner-cursor").InnerCursor;
const ObjectID = require("mongodb").ObjectID;
const {
  resolveUserId,
  resolveAccountId,
  normalizeContext,
  resolveTargets,
  recordUpdates,
  recordDeletes
} = require("./audit");

async function settleAudit(simpleDao, auditor, auditPromise, logMessage) {
  if (auditor.strict) {
    await auditPromise;
    return;
  }
  auditPromise.catch((err) => {
    simpleDao.logError(logMessage, err);
  });
}

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

  async update(query, update, options, context) {
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
      let targetsPromise;
      let folder;
      if (auditor) {
        const contextFields = normalizeContext(context);
        folder = contextFields.folder;
        resolvedUserId = resolveUserId({update, explicitUserId: contextFields.userId});
        const accountIdHint = resolveAccountId({
          query,
          update,
          explicitAccountId: contextFields.accountId
        });
        // Find and update run concurrently. If multi is false, the first find
        // match may not be the document Mongo updates (no shared sort).
        targetsPromise = resolveTargets(collection, query, {accountIdHint});
        if (!auditor.strict) {
          targetsPromise.catch(() => {});
        }
      }
      const result = await collection.update(query, update, Operator.cleanOptions(options));
      const endResult = result.result;
      endResult.updatedExisting = endResult.nModified > 0;
      if (auditor) {
        await settleAudit(
          this.simpleDao,
          auditor,
          recordUpdates(auditor, {
            targets: targetsPromise,
            collectionName: this.collectionName,
            userId: resolvedUserId,
            query,
            payload: update,
            multi: Boolean(options && options.multi),
            folder
          }),
          "SimpleDao: Error performing update audit"
        );
      }
      return endResult;
    } catch (err) {
      this.simpleDao.logError("SimpleDao: Error performing update", err);
      throw err;
    }
  }

  async remove(query, context) {
    if (!query) {
      throw new Error("query can't be undefined or null");
    }

    try {
      const db = await this.simpleDao.connect();
      const collection = db.collection(this.collectionName);
      const auditor = this.simpleDao.auditor;
      let resolvedUserId = undefined;
      let targetsPromise;
      let folder;
      if (auditor) {
        const contextFields = normalizeContext(context);
        folder = contextFields.folder;
        resolvedUserId = resolveUserId({explicitUserId: contextFields.userId});
        const accountIdHint = resolveAccountId({query, explicitAccountId: contextFields.accountId});
        // Find and remove run concurrently; matched ids can drift if data changes.
        targetsPromise = resolveTargets(collection, query, {accountIdHint});
        if (!auditor.strict) {
          targetsPromise.catch(() => {});
        }
      }
      const result = await collection.remove(query);
      if (auditor) {
        await settleAudit(
          this.simpleDao,
          auditor,
          recordDeletes(auditor, {
            targets: targetsPromise,
            collectionName: this.collectionName,
            userId: resolvedUserId,
            query,
            folder
          }),
          "SimpleDao: Error performing remove audit"
        );
      }
      return result.result;
    } catch (err) {
      this.simpleDao.logError("SimpleDao: Error performing remove", err);
      throw err;
    }
  }

  async removeById(id, context) {
    let _id = id;

    if (typeof id === "string") {
      _id = new ObjectID(id);
    }

    return this.remove({_id}, context);
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
