"use strict";

let pmongo = require("promised-mongo");

function mapFor(factory) {
  return function findHandler(models) {
    return models.map(function (model) {
      return factory(model);
    });
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

Finder.prototype.find = function (query, options) {
  let cursor;
  if (!options) {
    cursor = this.collection.find(query);
  } else {
    cursor = this.collection.find(query, options);
  }
  return new InnerCursor(cursor, this.factory);
};


function connectionString(dbConfig) {
  let hostPortPairs = dbConfig.uris.map(function (uri) {
    return `${uri}/${dbConfig.options.database}`;
  }).join(",");
  if (dbConfig.options.username.length > 0) {
    return `${dbConfig.options.username}:${dbConfig.options.password}@${hostPortPairs}`;
  }
  return hostPortPairs;
}

function SimpleDao(options, _mongoDriver_) {
  this.db = _mongoDriver_ || pmongo(connectionString(options.db));
}

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