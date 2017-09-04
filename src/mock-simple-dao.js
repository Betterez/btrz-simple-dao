"use strict";
const {objectId} = require("./simple-dao").SimpleDao,
  InnerCursor =  require("./inner-cursor").InnerCursor;

const mockDataResult = {
  getCollectionName() {
    return "mock";
  },
  factory(data) {
    return data;
  }
};

const cursor = (data) => {
  return Promise.resolve({
    toArray() {
      return Promise.resolve(data);
    },
    toCursor() {}
  });
};

const mockDao = (source) => {
  source = source || {};
  return {
    for() {return this;},
    findById() { 
      return Promise.resolve(source.findById || {});
    },
    find() {
      const mockCursor = cursor(source.find || []);
      return new InnerCursor(mockCursor, mockDataResult.factory);
    },
    update(data) {
      return Promise.resolve(data || source.update || {});
    },
    save(data) {
      return Promise.resolve(data || source.update || {});
    },
    aggregate() { 
      return Promise.resolve(source.aggregate || {});
    },
    objectId(id) {
      return objectId(id);
    },
    count() {
      return Promise.resolve(source.count || {});
    },
    findAggregate() {
      const mockCursor = cursor(source.findAggregate || []);
      return new InnerCursor(mockCursor, mockDataResult.factory);
    },
    findOne() {
      return Promise.resolve(source.findOne || {});
    },
    removeById() {
      return Promise.resolve(source.removeById || {});
    },
    distinct() {
      return Promise.resolve(source.distinct || []);
    }
  }
};

module.exports = mockDao;