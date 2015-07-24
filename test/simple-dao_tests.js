/*jshint expr: true*/
"use strict";

describe("SimpleDao", function () {

  let SimpleDao = require("../").SimpleDao,
    DataMapResult = require("./data-map-result").DataMapResult,
    ObjectID = require("mongodb").ObjectID,
    CollectionNameModel = require("./collection-name-model").CollectionNameModel,
    chai = require("chai"),
    chaiAsPromised = require("chai-as-promised"),
    sinon = require("sinon"),
    Chance = require("chance").Chance,
    chance =  new Chance(),
    config = {
      db: {
      options: {
          database: "simple_dao_test",
          username: "",
          password: ""
        },
        uris: ["127.0.0.1:27017"]
      }
    };

  chai.use(chaiAsPromised);
  let expect = chai.expect, simpleDao;
  beforeEach(function () {
    simpleDao = new SimpleDao(config);
  });

  describe("objectId", function () {

    describe("static method", function () {

      it("should return a new objectId", function () {
        expect(SimpleDao.objectId()).to.be.an.instanceOf(ObjectID);
      });

      it("should return an objectId from the given 24 characters argument", function () {
        let id = "55b27c2a74757b3c5e121b0e";
        expect(SimpleDao.objectId(id).toString()).to.be.eql(id);
      });
    });

    describe("instance public method", function () {

      it("should return a new objectId", function () {
        expect(simpleDao.objectId()).to.be.an.instanceOf(ObjectID);
      });

      it("should return an objectId from the given 24 characters argument", function () {
        let id = "55b27c2a74757b3c5e121b0e";
        expect(simpleDao.objectId(id).toString()).to.be.eql(id);
      });
    });

  });

  describe("connection-string", function () {

    it("should generate a connection-string for one db server no username/password", function () {
      expect(simpleDao.connectionString).to.be.eql("127.0.0.1:27017/simple_dao_test");
    });

    it("should generate a connection-string for one db server with username/password", function () {
      let config = {
        db: {
        options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd"
          },
          uris: [
            "127.0.0.1:27017"
          ]
        }
      };
      simpleDao = new SimpleDao(config);
      expect(simpleDao.connectionString).to.be.eql("usr:pwd@127.0.0.1:27017/simple_dao_test");
    });

    it("should generate a connection-string for many db servers no username/password", function () {
      let config = {
        db: {
        options: {
            database: "simple_dao_test",
            username: "",
            password: ""
          },
          uris: [
            "127.0.0.1:27017",
            "127.0.0.2:27017"
          ]
        }
      };
      simpleDao = new SimpleDao(config);
      expect(simpleDao.connectionString).to.be.eql("127.0.0.1:27017,127.0.0.2:27017/simple_dao_test");
    });

    it("should generate a connection-string for many db server with username/password", function () {
      let config = {
        db: {
        options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd"
          },
          uris: [
            "127.0.0.1:27017",
            "127.0.0.2:27017"
          ]
        }
      };
      simpleDao = new SimpleDao(config);
      expect(simpleDao.connectionString).to.be.eql("usr:pwd@127.0.0.1:27017,127.0.0.2:27017/simple_dao_test");
    });

  });

  describe("for(Constructor)", function () {

    it("should use the static collectionName()", function () {
      let findSpy = sinon.spy();
      let collectionSpy = sinon.spy(function () {
        return {find: findSpy};
      });
      let fakeMongo = {collection: collectionSpy};
      let sd = new SimpleDao(config, fakeMongo);
      sd.for(CollectionNameModel).find();
      expect(collectionSpy.getCall(0).args[0]).to.be.eql("a_simple_collection");
    });

    describe(".findById(id)", function () {

      it("should get a single object for that id", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then(function (saved) {
          let promise = simpleDao.for(DataMapResult).findById(saved._id.toString());
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.be.instanceOf(DataMapResult).and.notify(done);
        });
      });

      it("should return null if can't find it", function (done) {
        let promise = simpleDao.for(DataMapResult).findById(chance.hash());
        expect(promise).to.be.fulfilled;
        expect(promise).to.eventually.be.null.and.notify(done);
      });

    });

    describe(".findOne(query)", function () {

      it("should get a single object given a query", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then(function () {
          let promise = simpleDao.for(DataMapResult).findOne({accountId: "account-id"});
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.be.instanceOf(DataMapResult).and.notify(done);
        });
      });

      it("should return null if can't find it", function (done) {
        let promise = simpleDao.for(DataMapResult).findOne({accountId: chance.hash()});
        expect(promise).to.be.fulfilled;
        expect(promise).to.eventually.be.null.and.notify(done);
      });
    });

    describe(".find(query, projection).toArray()", function () {

      it("should call find on the driver, passing the arguments and returning a promise", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then(function () {
          let query = {accountId: "account-id"};
          let promise = simpleDao.for(DataMapResult).find(query).toArray();
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.have.length.above(1).and.notify(done);
        });
      });

      it("should throw if the ObjectType doesn't have a factory function", function () {
        function NoFactory() {

        }
        function sut() {
          let sd = new SimpleDao(config);
          sd.for(NoFactory);
        }
        expect(sut).to.throw();
      });
    });

    describe(".find(query, projection).toCursor()", function () {
      it("should call find on the driver, passing the arguments and returning a cursor", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then(function () {
          let query = {accountId: "account-id"};
          let cursor = simpleDao.for(DataMapResult).find(query).toCursor();
          expect(cursor.next).to.be.a("function");
          done();
        });
      });
    });

    describe(".aggregate(collectionName, query)", function () {

      it("should return a promise with a cursor", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then(function () {
          let query = [
            { $group: { _id: "$accountId", totalPop: { $sum: "$dataMapId" } } }
          ];
          let result = simpleDao.aggregate("datamapresult", query);
          expect(result).to.eventually.have.property("on").and.notify(done);
        });
      });
    });
  });

  describe("save(model)", function () {

    it("should throw if there is no model", function () {
      function sut() {
        simpleDao.save();
      }
      expect(sut).to.throw();
    });

    it("should return a promise after saving to the db", function () {
      let dmr = new DataMapResult("1");
      let promise = simpleDao.save(dmr);
      expect(promise.then).to.not.be.undefined;
    });

    it("should add the _id from the db if the object doesn't have one", function (done) {
      let dmr = new DataMapResult("1");
      expect(simpleDao.save(dmr)).to.eventually.have.property("_id").and.notify(done);
    });

    it("should infer the collection name from the Object name.toLowerCase()", function () {
      let saveSpy = sinon.spy();
      let collectionSpy = sinon.spy(function () {
        return {save: saveSpy};
      });
      let fakeMongo = {collection: collectionSpy};
      let dmr = new DataMapResult("1");
      let sd = new SimpleDao(config, fakeMongo);
      sd.save(dmr);
      expect(saveSpy.calledOnce).to.be.true;
      expect(collectionSpy.getCall(0).args[0]).to.be.eql("datamapresult");
    });

    it("should use the static collectionName()", function () {
      let saveSpy = sinon.spy();
      let collectionSpy = sinon.spy(function () {
        return {save: saveSpy};
      });
      let fakeMongo = {collection: collectionSpy};
      let cn = new CollectionNameModel();
      let sd = new SimpleDao(config, fakeMongo);
      sd.save(cn);
      expect(saveSpy.calledOnce).to.be.true;
      expect(collectionSpy.getCall(0).args[0]).to.be.eql("a_simple_collection");
    });
  });

  after(function () {
    // simpleDao.db.dropCollection("datamapresult").done();
  });
});
