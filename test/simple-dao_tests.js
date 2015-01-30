/*jshint expr: true*/
"use strict";

describe("SimpleDao", function () {

  let SimpleDao = require("../").SimpleDao,
    DataMapResult = require("./data-map-result").DataMapResult,
    expect = require("chai").expect,
    sinon = require("sinon"),
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

  let simpleDao;
  beforeEach(function () {
    simpleDao = new SimpleDao(config);
  });

  describe("find(Constructor).with(query, projection, etc)", function () {

    it("should call find on the driver, passing the arguments and return a promise", function (done) {
      let dmr = new DataMapResult("1");
      dmr.accountId = "account-id";
      simpleDao.save(dmr);
      let sd = new SimpleDao(config),
        query = {accountId: "account-id"};
      let promise = sd.for(DataMapResult).find(query).toArray();
      promise.then(function (models) {
        expect(models.length).to.not.be.eql(0);
        done();
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

      function saved(savedDmr) {
        expect(savedDmr._id).to.not.be.undefined;
        done();
      }
      let dmr = new DataMapResult("1");
      simpleDao.save(dmr).then(saved);
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
      expect(saveSpy.calledOnce).to.be.true();
      expect(collectionSpy.getCall(0).args[0]).to.be.eql("datamapresult");
    });
  });

  after(function () {
    simpleDao.db.dropCollection("datamapresult").done();
  });
});