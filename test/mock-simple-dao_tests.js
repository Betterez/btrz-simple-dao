"use strict";

describe("Mock SimpleDao", function () {
  const mockDao = require("../").mockSimpleDao,
    SimpleDao = require("../").SimpleDao,
    chai = require("chai"),
    expect = chai.expect,
    config = {
      db: {
      options: {
          database: "simple_dao_test",
          username: "",
          password: ""
        },
        uris: ["127.0.0.1:27017"]
      }
    },
    excludedMethods = ["constructor", "connect", "logError", "logInfo", "collectionNames", "dropCollection"];
  let simpleDao, source;
  
  beforeEach(function () {
    simpleDao = new SimpleDao(config);
    source = {
      find: [{foo: "bar"}],
      findById: {foo: "bar"},
      update: {foo: "bar"},
      aggregate: {foo: "bar"},
      count: 10,
      findOne: {},
      removeById: {},
      findAggregate: []
    };
  });

  // this tests the mock contains the same api that simple-dao, 
  // then if we add any method to simple-dao it should be reflected in the mock dao
  it("should use the simple-dao api", () => {
    const DataMapResult = require("./data-map-result").DataMapResult,
      daoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(simpleDao))
        .filter((method) => {
          return excludedMethods.indexOf(method) === -1 && typeof simpleDao[method] === "function";
        }),
      operator = simpleDao.for(DataMapResult),
      operatorMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(operator))
        .filter((method) => {
          return excludedMethods.indexOf(method) === -1 && typeof operator[method] === "function";
        });
    
    
    daoMethods.forEach((prop) => {
      expect(mockDao(source)[prop]).to.be.a("function");
    });
    
    operatorMethods.forEach((prop) => {
      expect(mockDao(source)[prop]).to.be.a("function");
    });
  });

  it("should convert the objectId", () => {
    const id = simpleDao.objectId();
    expect(mockDao().objectId(id.toString())).to.be.eql(id);
  })

  it("should return the find result", (done) => {
    return mockDao(source).for().find()
      .then((result) => {
        expect(result).to.be.eql(source.find);
        done();
      });
  });

  it("should return the default find result", (done) => {
    return mockDao().for().find()
      .then((result) => {
        expect(result).to.be.eql([]);
        done();
      });
  });

  it("should return the findById result", (done) => {
    return mockDao(source).for().findById()
      .then((result) => {
        expect(result).to.be.eql(source.findById);
        done();
      });
  });

  it("should return the default findById result", (done) => {
    return mockDao().for().findById()
      .then((result) => {
        expect(result).to.be.eql({});
        done();
      });
  });

  it("should return the update result", (done) => {
    const objToSave = {foo: "bar"};
    return mockDao(source).for().update(objToSave)
      .then((result) => {
        expect(result).to.be.eql(objToSave);
        done();
      });
  });

  it("should return the save result", (done) => {
    const objToSave = {foo: "bar"};
    return mockDao(source).for().save(objToSave)
      .then((result) => {
        expect(result).to.be.eql(objToSave);
        done();
      });
  });

  it("should return the aggregate result", (done) => {
    return mockDao(source).for().aggregate()
      .then((result) => {
        expect(result).to.be.eql(source.aggregate);
        done();
      });
  });

  it("should return the count result", (done) => {
    return mockDao(source).for().count()
      .then((result) => {
        expect(result).to.be.eql(source.count);
        done();
      });
  });

  it("should return the findOne result", (done) => {
    return mockDao(source).for().findOne()
      .then((result) => {
        expect(result).to.be.eql(source.findOne);
        done();
      });
  });

  it("should return the removeById result", (done) => {
    return mockDao(source).for().removeById()
      .then((result) => {
        expect(result).to.be.eql(source.removeById);
        done();
      });
  });

  it("should return the findAggregate result", (done) => {
    return mockDao(source).for().findAggregate()
      .then((result) => {
        expect(result).to.be.eql(source.findAggregate);
        done();
      });
  });
});