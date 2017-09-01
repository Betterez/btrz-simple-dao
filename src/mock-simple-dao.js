"use strict";
const {objectId} = require("./simple-dao").SimpleDao;

const mockDao = (source) => {
  source = source || {};
  return {
    for() {return this;},
    findById() { 
      return Promise.resolve(source.findById || {});
    },
    find() { 
      return Promise.resolve(source.find || []);
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
      return Promise.resolve(source.findAggregate || []);
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