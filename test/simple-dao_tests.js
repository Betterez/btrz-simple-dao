/*jshint expr: true*/

const ObjectID = require("mongodb").ObjectID;
const MongoClient = require("mongodb").MongoClient;
const chai = require("chai");
const expect = chai.expect;
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const sinon = require("sinon");
const sandbox = sinon.createSandbox();
const {ALL_AUTH_MECHANISMS, ALL_READ_PREFERENCES} = require("../constants");
const SimpleDao = require("../").SimpleDao;
const {getConnectionString} = require("../src/simple-dao");
const DataMapResult = require("./data-map-result").DataMapResult;
const CollectionNameModel = require("./collection-name-model").CollectionNameModel;


async function databaseHasCollection(db, collectionName) {
  const allCollections = await db.listCollections().toArray();
  return allCollections.some(collection => collection.name === collectionName);
}


describe("SimpleDao", function () {
  let config = null;
  let simpleDao = null;


  beforeEach(function () {
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

    simpleDao = new SimpleDao(config);
  });

  afterEach(async () => {
    sandbox.restore();
  });

  after(async () => {
    const db = await simpleDao.connect();
    const databaseHasDatamapCollection = await databaseHasCollection(db, "datamapresult");

    // When running only part of the test suite using .only, this collection may not exist.  Don't try to drop it if it doesn't exist.
    if (databaseHasDatamapCollection) {
      return simpleDao.dropCollection("datamapresult");
    }
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

  describe("getConnectionString()", function () {
    it("should return a valid connection string for one db server", function () {
      const connectionString = getConnectionString(config.db);
      expect(connectionString).to.eql("127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT");
    });

    it("should return a valid connection string for one db server using authentication credentials", function () {
      let config = {
        db: {
          options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd"
          },
          uris: ["127.0.0.1:27017"]
        }
      };
      const connectionString = getConnectionString(config.db);
      expect(connectionString).to.eql("usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT");
    });

    it("should return a valid connection string for many db servers using authentication credentials", function () {
      const config = {
        db: {
          options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd"
          },
          uris: [
            "127.0.0.1:27017",
            "127.0.0.2:27018"
          ]
        }
      };
      const connectionString = getConnectionString(config.db);
      expect(connectionString).to.eql("usr:pwd@127.0.0.1:27017,127.0.0.2:27018/simple_dao_test?authMechanism=DEFAULT");
    });

    it("should return a valid connection string that includes the specified authentication mechanism", () => {
      for (const authMechanism of ALL_AUTH_MECHANISMS) {
        const config = {
          db: {
            options: {
              database: "simple_dao_test",
              username: "usr",
              password: "pwd",
              authMechanism
            },
            uris: ["127.0.0.1:27017"]
          }
        };
        const connectionString = getConnectionString(config.db);
        expect(connectionString).to.eql(`usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=${authMechanism}`);
      }
    });

    it("should throw an error if an invalid authentication mechanism is specified", () => {
      const config = {
        db: {
          options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd",
            authMechanism: "some_invalid_auth_mechanism"
          },
          uris: ["127.0.0.1:27017"]
        }
      };
      expect(() => getConnectionString(config.db))
        .to.throw("Database config 'authMechanism' must be one of DEFAULT, MONGODB-CR, SCRAM-SHA-1, SCRAM-SHA-256");
    });

    it("should return a valid connection string that includes the specified read preference", () => {
      for (const readPreference of ALL_READ_PREFERENCES) {
        const config = {
          db: {
            options: {
              database: "simple_dao_test",
              username: "usr",
              password: "pwd",
              readPreference
            },
            uris: ["127.0.0.1:27017"]
          }
        };
        const connectionString = getConnectionString(config.db);
        expect(connectionString).to.eql(`usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT&readPreference=${readPreference}`);
      }
    });

    it("should throw an error if an invalid read preference is specified", () => {
      const config = {
        db: {
          options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd",
            readPreference: "some_invalid_read_preference"
          },
          uris: ["127.0.0.1:27017"]
        }
      };
      expect(() => getConnectionString(config.db)).to.throw("When specified, database config 'readPreference' " +
        "must be one of primary, primaryPreferred, secondary, secondaryPreferred, nearest");
    });

    it("should return a valid connection string that includes the specified replica set name", () => {
      const config = {
        db: {
          options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd",
            replicaSet: "replica_set_name"
          },
          uris: ["127.0.0.1:27017"]
        }
      };
      const connectionString = getConnectionString(config.db);
      expect(connectionString).to.eql(
        `usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT&replicaSet=${config.db.options.replicaSet}`);
    });
  });

  describe("connect", () => {
    let configForOtherDatabase = null;

    beforeEach(() => {
      configForOtherDatabase = {
        db: {
          options: {
            database: "simple_dao_test_2",
            username: "",
            password: ""
          },
          uris: ["127.0.0.1:27017"]
        }
      };
    });

    afterEach(() => {

    });

    it("should connect to the database and return an object that allows operations on the specified database", async () => {
      const db = await simpleDao.connect();
      expect(db.databaseName).to.eql(config.db.options.database);
      const result = await db.collection("test_collection").insertOne({test: true});
      const _id = result.insertedId;
      const [insertedDocument] = await db.collection("test_collection").find({_id}).toArray();
      expect(insertedDocument).to.contain({test: true});
    });

    it("should share database connections across multiple instances of the SimpleDao " +
      "when a connection to a particular database has already been established", async () => {
      const connectionSpy = sandbox.spy(MongoClient, "connect");

      expect(connectionSpy.callCount).to.eql(0);
      const simpleDao2 = new SimpleDao(configForOtherDatabase);
      const db2 = await simpleDao2.connect();
      expect(connectionSpy.callCount).to.eql(1);

      // Create a new instance of the SimpleDao and connect to the database again.
      // Since we already connected to this database in the previous instance, we expect that connection to be re-used.
      const simpleDao3 = new SimpleDao(configForOtherDatabase);
      const db3 = await simpleDao3.connect();
      expect(db3 === db2).to.be.true;
      expect(connectionSpy.callCount).to.eql(1);

      // Change which database we are connecting to
      configForOtherDatabase.db.options.database = "simple_dao_test_3";

      // Create a new instance.  We expect it to form a new connection, since we haven't connected to this database yet.
      const simpleDao4 = new SimpleDao(configForOtherDatabase);
      const db4 = await simpleDao4.connect();
      expect(db4 === db3).to.be.false;
      expect(connectionSpy.callCount).to.eql(2);

      // Create another instance, which should re-use the connection from the previous instance
      const simpleDao5 = new SimpleDao(configForOtherDatabase);
      const db5 = await simpleDao5.connect();
      expect(db5 === db4).to.be.true;
      expect(connectionSpy.callCount).to.eql(2);
    });

    it("should automatically reconnect when the database connection was unexpectedly closed", async () => {
      // Change which database we are connecting to
      configForOtherDatabase.db.options.database = "simple_dao_test_4";

      const connectionSpy = sandbox.spy(MongoClient, "connect");

      expect(connectionSpy.callCount).to.eql(0);
      const simpleDao2 = new SimpleDao(configForOtherDatabase);
      const dbConnection2 = await simpleDao2.connect();
      expect(connectionSpy.callCount).to.eql(1);

      // Close the database connection.
      // The next time we try to connect, we expect the simpleDao to form a new connection to the database.
      dbConnection2.close();
      const dbConnection3 = await simpleDao2.connect();
      expect(dbConnection2 === dbConnection3).to.be.false;
      expect(connectionSpy.callCount).to.eql(2);
    });

    it("should reconnect on subsequent calls after the initial connection rejects with an error", async () => {
      // Change which database we are connecting to
      configForOtherDatabase.db.options.database = "simple_dao_test_5";

      const connectionStub = sandbox.stub(MongoClient, "connect").rejects(new Error("Some mongo error"));

      expect(connectionStub.callCount).to.eql(0);
      const simpleDao2 = new SimpleDao(configForOtherDatabase);
      try {
        await simpleDao2.connect();
        expect.fail();
      } catch (err) {
        expect(err.message).to.eql("Some mongo error");
        expect(connectionStub.callCount).to.eql(1);
      }

      // Allow the database connection to proceed normally, without rejection.
      // We expect the simpleDao to form a new connection to the database.
      connectionStub.reset();
      expect(connectionStub.callCount).to.eql(0);
      connectionStub.callThrough();
      await simpleDao2.connect();
      expect(connectionStub.callCount).to.eql(1);
    });
  });

  describe("for(Constructor)", function () {

    it("should use the static collectionName()", function () {
      let findSpy = sinon.spy();
      let collectionSpy = sinon.spy(function () {
        return {find: findSpy};
      });
      let fakeMongo = {collection: collectionSpy};
      let sd = new SimpleDao(config);
      sd.connect = function () {
        return Promise.resolve(fakeMongo);
      }
      sd.for(CollectionNameModel).find()
        .toCursor()
          .then(()=> {
            expect(collectionSpy.getCall(0).args[0]).to.be.eql("a_simple_collection");
          })
          .catch((err) => {
            done(err);
          });
    });

    describe(".count(query)", function () {
      it("should get the count from the collection", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr)
          .then(function () {
            let query = {accountId: "account-id"};
            let promise = simpleDao.for(DataMapResult).count(query);
            expect(promise).to.be.fulfilled;
            expect(promise).to.eventually.be.eql(1).and.notify(done);
        });
      });
    });

    describe(".dropCollection(collectionName)", function () {
      it("should drop the collection", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr)
          .then(function () {
            let promise = simpleDao.dropCollection("datamapresult");
            expect(promise).to.be.fulfilled;
            expect(promise).to.eventually.be.eql(true).and.notify(done);
        });
      });
    });

    // this exists for compatibility with the soon-to-be-removed mongoskin API
    describe("connect().then(db => db.gridfs)", function () {

      let db = null;

      const GridStore = require('mongodb').GridStore;

      beforeEach(() => {
        return simpleDao.connect().then((database) => {
          db = database;
        });
      });

      it('should allow writing files', function (done) {
        const fileName = "tintin";
        const path = "test/fixtures/tintin.jpg";
        const data = require("fs").readFileSync(path);

        return new Promise((resolve, reject) => {
          db.gridfs().open(fileName, "w", (err, gs) => {
            if (err) {
              reject(err, null);
              return;
            }
            gs.write(data, (err2) => {
              if (err2) {
                reject(err2, null);
                return;
              }
              gs.close(resolve);
            });
          });
        }).then(() => {
          const gs = new GridStore(db, fileName, "r");
          gs.open(function(err, gsx) {
            gs.seek(0, function() {
              gs.read(function(err, readData) {
                db.close();
                expect(data.toString('base64')).to.eq(readData.toString('base64'));
                done();
              });
            });
          });
        });
      });

      it('should allow reading files', function (done) {
        const fileName = "tintin";
        const path = "test/fixtures/tintin.jpg";
        const data = require("fs").readFileSync(path);

        const gridStore = new GridStore(db, fileName, 'w');
        gridStore.open(function(err, gridStore) {
          gridStore.write(data, function(err, gridStore) {
            gridStore.close(function(err, result) {
              return simpleDao.connect().then(db => {
                db.gridfs().open(fileName, "r", function (err, gs) {
                  gs.read((err, readData) => {
                    expect(data.toString('base64')).to.eq(readData.toString('base64'));
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    describe(".findById(id)", function () {

      it("should get a single object for the passed objectId", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr)
          .then(function (saved) {
            let promise = simpleDao.for(DataMapResult).findById(saved._id);
            expect(promise).to.be.fulfilled;
            expect(promise).to.eventually.be.instanceOf(DataMapResult).and.notify(done);
        })
        .catch((err) => {
          done(err);
        });
      });

      it("should get a single object for the passed string id", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then(function (saved) {
          let promise = simpleDao.for(DataMapResult).findById(saved._id.toString());
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.be.instanceOf(DataMapResult).and.notify(done);
        });
      });

      it("should return null if can't find it", function (done) {
        let promise = simpleDao.for(DataMapResult).findById(new ObjectID());
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
        let promise = simpleDao.for(DataMapResult).findOne({accountId: new ObjectID().toString()});
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
          expect(promise).to.eventually.have.length.above(0).and.notify(done);
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
          simpleDao.for(DataMapResult)
            .find(query)
            .toCursor()
            .then((cursor) => {
              expect(cursor.next).to.be.a("function");
              done();
            })
            .catch((err) => {
              done(err);
            });
        });
      });
    });

    describe("(operator).findAggregate(query)", function () {
      it("should call aggregate on the dao, passing the arguments and returning a cursor", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then(function () {
          let query = [
            {$match: {accountId: "account-id"}},
            {$group: { _id: "$accountId", totalPop: { $sum: "$dataMapId" } } }
          ];
          simpleDao.for(DataMapResult)
            .findAggregate(query)
            .toCursor()
            .then((cursor) => {
            expect(cursor.next).to.be.a("function");
          done();
        })
          .catch((err) => {
            done(err);
        });
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
          let result = null
          for (var i = 0; i < 100; i++) {
            result = simpleDao.aggregate("datamapresult", query);
          }
          expect(result).to.eventually.have.property("on").and.notify(done);
        });
      });
    });

    describe(".update(query, update, options)", function () {

      it("should throw if there is no query", function () {
        function sut() {
          simpleDao.for(DataMapResult).update();
        }
        expect(sut).to.throw("query can't be undefined or null");
      });

      it("should throw if there is no update param", function () {
        function sut() {
          simpleDao.for(DataMapResult).update({});
        }
        expect(sut).to.throw("update can't be undefined or null");
      });

      it("should update a single object given a query and update param", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        dmr.status = "new";
        simpleDao.save(dmr).then(function () {
          let promise = simpleDao.for(DataMapResult)
            .update({accountId: "account-id"}, {$set: {status: "old"}});
          promise.then(function (updatedDocument) {
            expect(updatedDocument.ok).to.be.ok;
            expect(updatedDocument.n).to.be.eql(1);
            expect(updatedDocument.updatedExisting).to.be.ok;
            done();
          })
          .catch(function (err) { done(err);});
        });
      });

      it("should update a single object given a query, update param and options", function (done) {
        let dmr = new DataMapResult("45");
        dmr.accountId = "account-id-123";
        dmr.status = "new";
        simpleDao.save(dmr).then(function () {
          dmr = new DataMapResult("52");
          dmr.accountId = "account-id-123";
          dmr.status = "new";
          simpleDao.save(dmr).then(function () {
            let promise = simpleDao.for(DataMapResult).update({accountId: "account-id-123"}, {$set: {status: "old"}}, {multi: true});
            promise.then(function (updatedDocument) {
              expect(updatedDocument.ok).to.be.ok;
              expect(updatedDocument.n).to.be.eql(2);
              expect(updatedDocument.updatedExisting).to.be.ok;
              done();
            }).catch(function (err) { done(err);});
          });
        });
      });

      it("should return not updates if query not match", function (done) {
        let dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        dmr.status = "new";
        simpleDao.save(dmr).then(function () {
          let promise = simpleDao.for(DataMapResult).update({accountId: "not-existing"}, {status: "old"});
          promise.then(function (updatedDocument) {
            expect(updatedDocument.ok).to.be.ok;
            expect(updatedDocument.n).to.be.eql(0);
            done();
          }).catch(function (err) { done(err);});
        });
      });
    });

    describe(".removeById(id)", function () {

      it("should remove a single object for the passed objectId", function (done) {
        let dmr = new DataMapResult("1");
        simpleDao.save(dmr).then(function (saved) {
          let promise = simpleDao.for(DataMapResult).removeById(saved._id);
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.deep.equal({ok: 1, n: 1}).and.notify(done);
        })
        .catch((err) => {
          done(err);
        });
      });

      it("should remove a single object for the passed string id", function (done) {
        let dmr = new DataMapResult("1");
        simpleDao.save(dmr).then(function (saved) {
          let promise = simpleDao.for(DataMapResult).removeById(saved._id.toString());
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.deep.equal({ok: 1, n: 1}).and.notify(done);
        });
      });

      it("should return 0 count if can't find it", function (done) {
        let promise = simpleDao.for(DataMapResult).removeById(new ObjectID());
        expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.deep.equal({ok: 1, n: 0}).and.notify(done);
      });
    });

    describe(".distinct(field, query)", function () {

      beforeEach(function (done){
        let dmr = new DataMapResult("1");
        dmr.field = "A";
        dmr.accountId = "1";
        simpleDao.save(dmr).then(function () {
          let dmr2 = new DataMapResult("2");
          dmr2.field = "B";
          dmr2.accountId = "1";
          simpleDao.save(dmr2).then(function () {
            let dmr3 = new DataMapResult("3");
            dmr3.field = "A";
            dmr3.accountId = "1";
            simpleDao.save(dmr3).then(function () {
              let dmr4 = new DataMapResult("4");
              dmr4.field = "C";
              dmr4.accountId = "2";
              simpleDao.save(dmr4).then(function () {
                done();
              });
            });
          });
        });
      });

      it("should not return values", function (done) {
        let promise = simpleDao.for(DataMapResult).distinct();
        promise.then(function (results) {
          expect(results).to.be.an("array");
          expect(results.length).to.be.eql(0);
          done();
        }).catch(function (err) { done(err);});
      });

      it("should return the distinct values for field with no query", function (done) {
        let promise = simpleDao.for(DataMapResult).distinct("field");
        promise.then(function (results) {
          expect(results).to.be.an("array");
          expect(results.length).to.be.eql(3);
          expect(results[0]).to.be.eql("A");
          expect(results[1]).to.be.eql("B");
          expect(results[2]).to.be.eql("C");
          done();
        }).catch(function (err) { done(err);});
      });

      it("should return the distinct values for the field with the given query", function (done) {
        let query = {accountId: "1"};
        let promise = simpleDao.for(DataMapResult).distinct("field", query);
        promise.then(function (results) {
          expect(results).to.be.an("array");
          expect(results.length).to.be.eql(2);
          expect(results[0]).to.be.eql("A");
          expect(results[1]).to.be.eql("B");
          done();
        }).catch(function (err) { done(err);});
      });
    });

    describe(".remove(query, options)", function () {
      const dataMapId = "something",
        dmr1 = new DataMapResult(dataMapId),
        dmr2 = new DataMapResult(dataMapId),
        dmr3 = new DataMapResult("another");

      afterEach(() => {
        return simpleDao.for(DataMapResult).remove({});
      });

      it("should remove a single object for the passed objectId", (done) => {
        simpleDao.save(dmr1).then((saved) => {
          const promise = simpleDao.for(DataMapResult).remove({_id: saved._id});
          expect(promise).to.eventually.deep.equal({ok: 1, n: 1}).and.notify(done);
        })
        .catch(done);
      });

      it("should remove several objects with the passed query", (done) => {
        Promise.all([
          simpleDao.save(dmr1),
          simpleDao.save(dmr2),
          simpleDao.save(dmr3),
        ])
        .then(() => {
          const promise = simpleDao.for(DataMapResult).remove({dataMapId});
          expect(promise).to.eventually.deep.equal({ok: 1, n: 2}).and.notify(done);
        })
        .catch(done);
      });

      it("should remove all objects if the passed query is empty", (done) => {
        Promise.all([
          simpleDao.save(dmr1),
          simpleDao.save(dmr2),
          simpleDao.save(dmr3),
        ])
        .then(() => {
          const promise = simpleDao.for(DataMapResult).remove({});
          expect(promise).to.eventually.deep.equal({ok: 1, n: 3}).and.notify(done);
        })
        .catch(done);
      });

      it("should return 0 count if can't find it", (done) => {
        const promise = simpleDao.for(DataMapResult).remove({_id: new ObjectID()});
        expect(promise).to.eventually.deep.equal({ok: 1, n: 0}).and.notify(done);
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

    it("should update the value of model.updatedAt if field exists", () => {
      const dmr = new DataMapResult("1"),
        dateOfCreation = new Date(),
        expectedHoursAfterSave = dateOfCreation.getHours();

      dateOfCreation.setHours(dateOfCreation.getHours() - 1);
      dmr.updatedAt = {value: dateOfCreation};

      return simpleDao.save(dmr).then((saved) => {
        expect(saved.updatedAt).to.not.be.undefined;
        expect(saved.updatedAt.value).to.not.be.undefined;
        expect(saved.updatedAt.value).to.be.a("date");
        expect(saved.updatedAt.value.getHours()).to.equal(expectedHoursAfterSave);
      })
    });

    it("should not fail if model.updatedAt is undefined", () => {
      const dmr = new DataMapResult("1");
      return simpleDao.save(dmr).then((saved) => {
        expect(saved.updatedAt).to.be.undefined;
      })
    });

    it("should not fail if model.updatedAt.value is undefined", () => {
      const dmr = new DataMapResult("1");
      dmr.updatedAt = {value: undefined};
      return simpleDao.save(dmr).then((saved) => {
        expect(saved.updatedAt.value).to.be.undefined;
      })
    });

    it.skip("should use the static collectionName()", function () {
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
});
