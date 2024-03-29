

describe("Mock SimpleDao", () => {
  const mockDao = require("../").mockSimpleDao;
  const SimpleDao = require("../").SimpleDao;
  const chai = require("chai");
  const expect = chai.expect;
  const config = {
    db: {
      options: {
        database: "simple_dao_test",
        username: "",
        password: ""
      },
      uris: ["127.0.0.1:27017"]
    }
  };
  const excludedMethods = ["constructor", "_getMongoClient", "getCurrentClient", "connect", "logError", "logInfo", "collectionNames", "dropCollection"];
  let simpleDao = null;
  let source = null;


  class Model {
    static collectionName() {
      return "some_collection";
    }

    static factory(literal) {
      return Object.assign(new Model(), literal);
    }
  }


  beforeEach(() => {
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
    const daoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(simpleDao))
      .filter((method) => {
        return excludedMethods.indexOf(method) === -1 && typeof simpleDao[method] === "function";
      });
    const operator = simpleDao.for(Model);
    const operatorMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(operator))
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
  });

  it("should return the find result", () => {
    return mockDao(source).for().find().toArray()
      .then((result) => {
        expect(result).to.be.eql(source.find);
      });
  });

  it("should return the default find result", () => {
    return mockDao().for().find().toArray()
      .then((result) => {
        expect(result).to.be.eql([]);
      });
  });

  it("should return the findById result", () => {
    return mockDao(source).for().findById()
      .then((result) => {
        expect(result).to.be.eql(source.findById);
      });
  });

  it("should return the default findById result", () => {
    return mockDao().for().findById()
      .then((result) => {
        expect(result).to.be.eql({});
      });
  });

  it("should return the update result", () => {
    const objToSave = {foo: "bar"};
    return mockDao(source).for().update(objToSave)
      .then((result) => {
        expect(result).to.be.eql(objToSave);
      });
  });

  it("should return the save result", () => {
    const objToSave = {foo: "bar"};
    return mockDao(source).for().save(objToSave)
      .then((result) => {
        expect(result).to.be.eql(objToSave);
      });
  });

  it("should return the aggregate result", () => {
    return mockDao(source).for().aggregate()
      .then((result) => {
        expect(result).to.be.eql(source.aggregate);
      });
  });

  it("should return the count result", () => {
    return mockDao(source).for().count()
      .then((result) => {
        expect(result).to.be.eql(source.count);
      });
  });

  it("should return the findOne result", () => {
    return mockDao(source).for().findOne()
      .then((result) => {
        expect(result).to.be.eql(source.findOne);
      });
  });

  it("should return the removeById result", () => {
    return mockDao(source).for().removeById()
      .then((result) => {
        expect(result).to.be.eql(source.removeById);
      });
  });

  it("should return the findAggregate result", () => {
    return mockDao(source).for().findAggregate().toArray()
      .then((result) => {
        expect(result).to.be.eql(source.findAggregate);
      });
  });
});
