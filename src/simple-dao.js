"use strict";

let pmongo = require("promised-mongo"),
  MongoClient = require("mongodb").MongoClient;

function buildModel(factory) {
  return function (model) {
    return factory(model);
  };
}

function mapFor(factory) {
  return function findHandler(models) {
    return models.map(buildModel(factory));
  };
}

function InnerCursor(cursor, factory) {
  this.cursor = cursor;
  this.factory = factory;
}

InnerCursor.prototype.toCursor = function() {
  return this.cursor;
};

InnerCursor.prototype.toArray = function() {
  return this.cursor.toArray().then(mapFor(this.factory));
};

function Finder(collection, factory) {
  this.collection = collection;
  this.factory = factory;
}

Finder.prototype.aggregate = function (query) {
  return this.collection.aggregate(query);
};

Finder.prototype.find = function (query, options) {
  let cursor;
  if (!options) {
    cursor = this.collection.find(query);
  } else {
    cursor = this.collection.find(query, options);
  }
  return new InnerCursor(cursor, this.factory);
};

Finder.prototype.findOne = function (query) {
  let factory = this.factory;
  return this.collection.findOne(query).then(function (model) {
    return model ? buildModel(factory)(model) : model;
  });
};

Finder.prototype.findById = function (id) {
  return this.findOne({_id: id});
};

function connectionString(dbConfig) {
  var uris = dbConfig.uris.join(",");
  if (dbConfig.options.username.length > 0) {
    return `${dbConfig.options.username}:${dbConfig.options.password}@${uris}/${dbConfig.options.database}`;
  }
  return `${uris}/${dbConfig.options.database}`;
}

function SimpleDao(options, _mongoDriver_) {
  this.connectionString = connectionString(options.db);
  this.db = _mongoDriver_ || pmongo(this.connectionString);
}

SimpleDao.prototype.aggregate = function (collectionName, query) {
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
};

SimpleDao.prototype.for = function (ctrFunc) {
  if (!ctrFunc.factory) {
    throw new Error("The Ctr provided needs to have a factory function");
  }
  let collectionName = ctrFunc.name.toLowerCase();
  let collection = this.db.collection(collectionName);
  return new Finder(collection, ctrFunc.factory);
};

SimpleDao.prototype.save = function (model) {
  if (!model) {
    throw new Error("model can't be undefined or null");
  }
  let collectionName = model.constructor.name.toLowerCase();
  return this.db.collection(collectionName).save(model);
};

exports.SimpleDao = SimpleDao;
