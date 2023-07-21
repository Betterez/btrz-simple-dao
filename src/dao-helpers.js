class SimpleDaoArchive {
    constructor(_mainDao, _sndDao, logger = null, collectionName = null) {
      this.mainDao = _mainDao;
      this.sndDao = _sndDao;
      this.collectionName = collectionName;
      this.logger = logger;
      this.mongoDb = null;
      this.archiveDb = null;
      this.collectionDb = null;
      this.getDb(_mainDao).then((db) => {
        this.mongoDb = db;
        if (collectionName) {
          this.setCollection(this.mongoDb.collection(this.collectionName));
        }
      });
      this.getDb(_sndDao).then((db) => {
        this.archiveDb = db;
      });
    }

    static wrappingDao(mainDao, sndDao) {
        return new SimpleDaoArchive(mainDao, sndDao);
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
      return await this.mainDao.connect();
    }
  
    async getDb(dao) {
      if (dao) {
        const db = await dao.connect();
        return db;
      } else {
        this.logError("SimpleDaoArchive: DAO parameter is mandatory");
        return null;
      }
    }
  
    getDbFor(collection, query) {
      this.mongoDb
        .collection(collection)
        .find(query)
        .toArray()
        .then((results) => {
          if (results.length === 0) {
            return this.archiveDb;
          } else {
            return this.mongoDb;
          }
        });
    }
  
    setCollection(collection) {
      this.collectionDb = collection;
    }
  
    setCollectionName(collection) {
      this.collectionName = collection;
      return this;
    }
    
    collection(collectionName, archiveMode = false) {
      try {
        if (archiveMode) {
          this.setCollection(this.archiveDb.collection(this.collectionName));
          return this;
        } else {
          const newDaoWrapper = new SimpleDaoArchive(
            this.mainDao,
            this.sndDao,
            this.logger,
            collectionName
          );
          newDaoWrapper.setCollection(
            this.mongoDb.collection(newDaoWrapper.collectionName)
          );
          return newDaoWrapper;
        }
      } catch (error) {
        this.logError("SimpleDaoArchive: Error performing find", error);
        throw error;
      }
    }

    prepareArguments(_args, _fn) {
        const args = Array.from(_args);
        const args2 = args.slice(0, _args.length - 1);
        const origCb = args.splice(args.length - 1, 1);
        const wrpCb = this.wrapCallBack(origCb, _fn, args);
        args2.push(wrpCb);
        return [args2, origCb];
      }
  
    wrapCallBack(originalWrap, fn, args) {
      const self = this;
      return function wrappedDaoCb(err, result) {
        if (self.collectionDb.dbName === "betterez_core") {
          if (!result ^ (Array.isArray(result) && result.length === 0)) {
            self.collection(self.collectionName, true);
            args.push(originalWrap);
            fn.apply(self, args);
          } else {
            originalWrap(err, result);
          }
        } else {
          originalWrap(err, result);
        }
      };
    }
  
    find() {
      try {
        const [args, origWrap] = arguments;
        const wrapped = this.wrapCallBack(origWrap, this.find, [args]);
        this.collectionDb.find.apply(this.collectionDb, [args]).toArray(wrapped);
      } catch (error) {
        this.logError("SimpleDaoArchive: Error performing find", error);
        throw error;
      }
    }
    
    findOne() {
      try {
        const [args, origWrap] = arguments;
        const wrapped = this.wrapCallBack(origWrap, this.findOne, [args]);
        const _args = Array.from([args]);
        _args.push(wrapped);
        this.collectionDb.findOne.apply(this.collectionDb, _args);
      } catch (error) {
        this.logError("SimpleDaoArchive: Error performing findOne", error);
        throw error;
      }
    }

    async findForModel(model, query, options = {}) {
        try {
            let results = [];
            results = await this.mainDao.for(model)
                                        .find(query, options)
                                        .toArray();
            if (results.length === 0 && this.sndDao) {
                results = await this.sndDao.for(model)
                                            .find(query, options)
                                            .toArray();
            }
            return results;
        } catch (error) {
            this.logError("SimpleDaoArchive: Error performing find", error);
            throw error;
        }
    };

    async findByIdForModel(model, id) {
        try {
            let result = null;
            result = await this.mainDao.for(model)
                                .findById(id);
            if (!result  && this.sndDao) {
                result = await this.sndDao.for(model)
                                    .findById(id);
            }
            return result;
        } catch (error) {
            this.logError("SimpleDaoArchive: Error performing findById", error);
            throw error;
        }
    };
  }
  
  module.exports = {
    SimpleDaoArchive,
  };
  