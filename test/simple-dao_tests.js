const Chance = require("chance");
const chance = new Chance();
const {ObjectID, MongoClient, Cursor} = require("mongodb");
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


async function databaseHasCollection(db, collectionName) {
  const allCollections = await db.listCollections().toArray();
  return allCollections.some((collection) => { return collection.name === collectionName; });
}


describe("SimpleDao", () => {
  let config = null;
  let simpleDao = null;
  let collectionName = null;
  let model = null;

  class Model {
    static collectionName() {
      return collectionName;
    }

    static factory(literal) {
      return Object.assign(new Model(), literal);
    }
  }

  beforeEach(() => {
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
    collectionName = chance.word({length: 10});
    model = Model.factory({a: 1});

    simpleDao = new SimpleDao(config);
  });

  afterEach(async () => {
    sandbox.restore();

    const db = await simpleDao.connect();
    try {
      await db.dropCollection(collectionName);
    } catch (err) {}
  });

  after(async () => {
    const db = await simpleDao.connect();
    const databaseHasDatamapCollection = await databaseHasCollection(db, "datamapresult");

    // When running only part of the test suite using .only, this collection may not exist.  Don't try to drop it if it doesn't exist.
    if (databaseHasDatamapCollection) {
      return simpleDao.dropCollection("datamapresult");
    }
  });

  describe(".objectId()", () => {
    describe("static method", () => {
      it("should return a new objectId", () => {
        expect(SimpleDao.objectId()).to.be.an.instanceOf(ObjectID);
      });

      it("should return an objectId from the given 24 characters argument", () => {
        const id = "55b27c2a74757b3c5e121b0e";
        expect(SimpleDao.objectId(id).toString()).to.be.eql(id);
      });
    });

    describe("instance method", () => {
      it("should return a new objectId", () => {
        expect(simpleDao.objectId()).to.be.an.instanceOf(ObjectID);
      });

      it("should return an objectId from the given 24 characters argument", () => {
        const id = "55b27c2a74757b3c5e121b0e";
        expect(simpleDao.objectId(id).toString()).to.be.eql(id);
      });
    });
  });

  describe("getConnectionString()", () => {
    it("should return a valid connection string for one db server", () => {
      const connectionString = getConnectionString(config.db);
      expect(connectionString).to.eql("127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT");
    });

    it("should return a valid connection string for one db server using authentication credentials", () => {
      const config = {
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

    it("should return a valid connection string for many db servers using authentication credentials", () => {
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
      expect(() => { return getConnectionString(config.db); })
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
      expect(() => { return getConnectionString(config.db); }).to.throw("When specified, database config 'readPreference' " +
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
        `usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT&replicaSet=${config.db.options.replicaSet}`
      );
    });
  });

  describe(".connect()", () => {
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

    it("should connect to the database only once when multiple database requests arrive while the initial connection is still being " +
      "established", async () => {
      // Change which database we are connecting to
      configForOtherDatabase.db.options.database = "simple_dao_test_6";
      const simpleDao2 = new SimpleDao(configForOtherDatabase);

      const connectionSpy = sandbox.spy(MongoClient, "connect");
      expect(connectionSpy.callCount).to.eql(0);

      await Promise.all([
        simpleDao2.for(Model).find({}),
        simpleDao2.for(Model).find({}),
        simpleDao2.for(Model).find({})
      ]);

      expect(connectionSpy.callCount).to.eql(1);
    });
  });

  // this exists for compatibility with the soon-to-be-removed mongoskin API
  describe("connect().then(db => db.gridfs)", () => {
    let db = null;

    const GridStore = require("mongodb").GridStore;

    beforeEach(() => {
      return simpleDao.connect().then((database) => {
        db = database;
      });
    });

    it("should allow writing files", (done) => {
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
        gs.open((err, gsx) => {
          gs.seek(0, () => {
            gs.read((err, readData) => {
              db.close();
              expect(data.toString("base64")).to.eq(readData.toString("base64"));
              done();
            });
          });
        });
      });
    });

    it("should allow reading files", (done) => {
      const fileName = "tintin";
      const path = "test/fixtures/tintin.jpg";
      const data = require("fs").readFileSync(path);

      const gridStore = new GridStore(db, fileName, "w");
      gridStore.open((err, gridStore) => {
        gridStore.write(data, (err, gridStore) => {
          gridStore.close((err, result) => {
            return simpleDao.connect().then((db) => {
              db.gridfs().open(fileName, "r", (err, gs) => {
                gs.read((err, readData) => {
                  expect(data.toString("base64")).to.eq(readData.toString("base64"));
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe(".dropCollection()", () => {
    it("should drop the specified collection", async () => {
      const db = await simpleDao.connect();
      let collectionExists = await databaseHasCollection(db, collectionName);
      expect(collectionExists).to.be.false;

      await simpleDao.save(model);
      collectionExists = await databaseHasCollection(db, collectionName);
      expect(collectionExists).to.be.true;

      await simpleDao.dropCollection(collectionName);
      collectionExists = await databaseHasCollection(db, collectionName);
      expect(collectionExists).to.be.false;
    });
  });

  describe(".for()", () => {
    it("should return an Operator with the correct properties", () => {
      const operator = simpleDao.for(Model);
      expect(operator.simpleDao).to.eql(simpleDao);
      expect(operator.collectionName).to.eql(Model.collectionName());
      expect(operator.factory).to.eql(Model.factory);
    });

    it("should throw an error if the provided constructor function does not have a 'factory' method", () => {
      expect(() => simpleDao.for({})).to.throw("SimpleDao: The provided constructor function or class needs to have a factory function");
    });
  });

  describe(".aggregate()", () => {
    it("should perform the specified aggregate query on the specified collection", async () => {
      const modelOne = Model.factory({a: 1});
      const modelTwo = Model.factory({a: 2});
      await Promise.all([
        simpleDao.save(modelOne),
        simpleDao.save(modelTwo)
      ]);

      const query = {$group: {_id: 1, total: {$sum: "$a"}}};
      const cursor = await simpleDao.aggregate(collectionName, query);
      expect(cursor.constructor.name).to.eql("AggregationCursor");
      const result = await cursor.toArray();
      expect(result).to.deep.eql([{_id: 1, total: 3}]);
    });

    it("should reject if an error was encountered when connecting to the database", async () => {
      sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
      await expect(simpleDao.aggregate(collectionName, {})).to.eventually.be.rejectedWith("Some connection error");
    });
  });

  describe(".save()", () => {
    it("should save the model to the correct collection, as defined by the model constructor's `collectionName()` function", async () => {
      const db = await simpleDao.connect();
      let allDocumentsInCollection = await db.collection(model.constructor.collectionName()).find({}).toArray();
      expect(allDocumentsInCollection).to.have.length(0);

      await simpleDao.save(model);
      allDocumentsInCollection = await db.collection(model.constructor.collectionName()).find({}).toArray();
      expect(allDocumentsInCollection).to.have.length(1);
      expect(allDocumentsInCollection[0]._id.toString()).to.eql(model._id.toString());
    });

    it("should return the model", async () => {
      const result = await simpleDao.save(model);
      Reflect.deleteProperty(result, "_id");
      expect(result).to.deep.eql(model);
    });

    it("should reject if a model is not provided", async () => {
      await expect(simpleDao.save()).to.eventually.be.rejectedWith("SimpleDao: No data was provided in the call to .save()");
    });

    it("should mutate the model and assign the _id from the saved db document when the original model doesn't have an _id", async () => {
      expect(model._id).to.not.exist;
      await simpleDao.save(model);
      expect(model._id).to.exist;
      expect(model._id).to.be.an.instanceOf(ObjectID);
    });

    it("should save the model with its existing _id when the model is provided with an _id", async () => {
      const _id = ObjectID();
      model._id = _id;
      await simpleDao.save(model);
      expect(model._id.toString()).to.eql(_id.toString());
    });

    it("should mutate the model and set the value of 'model.updatedAt.value' to the current date, " +
      "when the model has an 'updatedAt.value' property", async () => {
      expect(model.updatedAt).to.not.exist;

      await simpleDao.save(model);
      expect(model.updatedAt).to.not.exist;

      model.updatedAt = {};
      await simpleDao.save(model);
      expect(model.updatedAt.value).to.not.exist;

      model.updatedAt = {value: "some value"};
      await simpleDao.save(model);
      expect(model.updatedAt.value).to.exist;
      expect(model.updatedAt.value).to.be.an.instanceOf(Date);
      // Check that the updatedAt timestamp is within 10 seconds of now
      const currentTimestamp = new Date().getTime();
      expect(model.updatedAt.value.getTime()).to.be.within(currentTimestamp - 10000, currentTimestamp + 10000);
    });
  });

  describe("Operator methods", () => {
    describe(".count()", () => {
      it("should return the number of records that match the specified query", async () => {
        const modelOne = Model.factory({a: 1});
        const modelTwo = Model.factory({a: 2});
        const modelThree = Model.factory({a: 2});
        await Promise.all([
          simpleDao.save(modelOne),
          simpleDao.save(modelTwo),
          simpleDao.save(modelThree)
        ]);

        let count = await simpleDao.for(Model).count({a: 1});
        expect(count).to.eql(1);

        count = await simpleDao.for(Model).count({a: 2});
        expect(count).to.eql(2);
      });

      it("should reject if an error was encountered when connecting to the database", async () => {
        sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
        await expect(simpleDao.for(Model).count({})).to.eventually.be.rejectedWith("Some connection error");
      });
    });

    describe(".find()", () => {
      describe(".toArray()", () => {
        it("should return an array of all documents that match the specified query", async () => {
          const modelOne = Model.factory({a: 1});
          const modelTwo = Model.factory({a: 2});
          await Promise.all([
            simpleDao.save(modelOne),
            simpleDao.save(modelTwo)
          ]);

          let result = await simpleDao.for(Model).find({a: {$gt: 0}}).toArray();
          expect(result).to.have.length(2);

          result = await simpleDao.for(Model).find({a: 1}).toArray();
          expect(result).to.have.length(1);
        });

        it("should reject if there was an error performing the query", async () => {
          return expect(simpleDao.for(Model).find({a: {$badOperator: 0}}).toArray()).to.eventually.be.rejectedWith("unknown operator");
        });
      });

      describe(".toCursor()", () => {
        it("should return a cursor for all documents that match the specified query", async () => {
          const modelOne = Model.factory({a: 1});
          const modelTwo = Model.factory({a: 2});
          await Promise.all([
            simpleDao.save(modelOne),
            simpleDao.save(modelTwo)
          ]);

          const cursor = await simpleDao.for(Model).find({a: {$gt: 0}}).toCursor();
          expect(cursor).to.be.an.instanceOf(Cursor);

          const results = await cursor.toArray();
          expect(results).to.have.length(2);
        });
      });
    });

    describe(".findOne()", () => {
      it("should get a single object given a query", (done) => {
        const dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then(() => {
          const promise = simpleDao.for(DataMapResult).findOne({accountId: "account-id"});
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.be.instanceOf(DataMapResult).and.notify(done);
        });
      });

      it("should return null if can't find it", (done) => {
        const promise = simpleDao.for(DataMapResult).findOne({accountId: new ObjectID().toString()});
        expect(promise).to.be.fulfilled;
        expect(promise).to.eventually.be.null.and.notify(done);
      });
    });

    describe(".findById()", () => {
      it("should get a single object for the passed objectId", (done) => {
        const dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr)
          .then((saved) => {
            const promise = simpleDao.for(DataMapResult).findById(saved._id);
            expect(promise).to.be.fulfilled;
            expect(promise).to.eventually.be.instanceOf(DataMapResult).and.notify(done);
          })
          .catch((err) => {
            done(err);
          });
      });

      it("should get a single object for the passed string id", (done) => {
        const dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then((saved) => {
          const promise = simpleDao.for(DataMapResult).findById(saved._id.toString());
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.be.instanceOf(DataMapResult).and.notify(done);
        });
      });

      it("should return null if can't find it", (done) => {
        const promise = simpleDao.for(DataMapResult).findById(new ObjectID());
        expect(promise).to.be.fulfilled;
        expect(promise).to.eventually.be.null.and.notify(done);
      });
    });

    describe(".findAggregate()", () => {
      it("should call aggregate on the dao, passing the arguments and returning a cursor", (done) => {
        const dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        simpleDao.save(dmr).then(() => {
          const query = [
            {$match: {accountId: "account-id"}},
            {$group: {_id: "$accountId", totalPop: {$sum: "$dataMapId"}}}
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

    describe(".update()", () => {
      it("should throw if there is no query", () => {
        function sut() {
          simpleDao.for(DataMapResult).update();
        }
        expect(sut).to.throw("query can't be undefined or null");
      });

      it("should throw if there is no update param", () => {
        function sut() {
          simpleDao.for(DataMapResult).update({});
        }
        expect(sut).to.throw("update can't be undefined or null");
      });

      it("should update a single object given a query and update param", (done) => {
        const dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        dmr.status = "new";
        simpleDao.save(dmr).then(() => {
          const promise = simpleDao.for(DataMapResult)
            .update({accountId: "account-id"}, {$set: {status: "old"}});
          promise.then((updatedDocument) => {
            expect(updatedDocument.ok).to.be.ok;
            expect(updatedDocument.n).to.be.eql(1);
            expect(updatedDocument.updatedExisting).to.be.ok;
            done();
          })
            .catch((err) => { done(err); });
        });
      });

      it("should update a single object given a query, update param and options", (done) => {
        let dmr = new DataMapResult("45");
        dmr.accountId = "account-id-123";
        dmr.status = "new";
        simpleDao.save(dmr).then(() => {
          dmr = new DataMapResult("52");
          dmr.accountId = "account-id-123";
          dmr.status = "new";
          simpleDao.save(dmr).then(() => {
            const promise = simpleDao.for(DataMapResult).update({accountId: "account-id-123"}, {$set: {status: "old"}}, {multi: true});
            promise.then((updatedDocument) => {
              expect(updatedDocument.ok).to.be.ok;
              expect(updatedDocument.n).to.be.eql(2);
              expect(updatedDocument.updatedExisting).to.be.ok;
              done();
            }).catch((err) => { done(err); });
          });
        });
      });

      it("should return not updates if query not match", (done) => {
        const dmr = new DataMapResult("1");
        dmr.accountId = "account-id";
        dmr.status = "new";
        simpleDao.save(dmr).then(() => {
          const promise = simpleDao.for(DataMapResult).update({accountId: "not-existing"}, {status: "old"});
          promise.then((updatedDocument) => {
            expect(updatedDocument.ok).to.be.ok;
            expect(updatedDocument.n).to.be.eql(0);
            done();
          }).catch((err) => { done(err); });
        });
      });
    });

    describe(".removeById()", () => {
      it("should remove a single object for the passed objectId", (done) => {
        const dmr = new DataMapResult("1");
        simpleDao.save(dmr).then((saved) => {
          const promise = simpleDao.for(DataMapResult).removeById(saved._id);
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.deep.equal({ok: 1, n: 1}).and.notify(done);
        })
          .catch((err) => {
            done(err);
          });
      });

      it("should remove a single object for the passed string id", (done) => {
        const dmr = new DataMapResult("1");
        simpleDao.save(dmr).then((saved) => {
          const promise = simpleDao.for(DataMapResult).removeById(saved._id.toString());
          expect(promise).to.be.fulfilled;
          expect(promise).to.eventually.deep.equal({ok: 1, n: 1}).and.notify(done);
        });
      });

      it("should return 0 count if can't find it", (done) => {
        const promise = simpleDao.for(DataMapResult).removeById(new ObjectID());
        expect(promise).to.be.fulfilled;
        expect(promise).to.eventually.deep.equal({ok: 1, n: 0}).and.notify(done);
      });
    });

    describe(".distinct()", () => {
      beforeEach((done) => {
        const dmr = new DataMapResult("1");
        dmr.field = "A";
        dmr.accountId = "1";
        simpleDao.save(dmr).then(() => {
          const dmr2 = new DataMapResult("2");
          dmr2.field = "B";
          dmr2.accountId = "1";
          simpleDao.save(dmr2).then(() => {
            const dmr3 = new DataMapResult("3");
            dmr3.field = "A";
            dmr3.accountId = "1";
            simpleDao.save(dmr3).then(() => {
              const dmr4 = new DataMapResult("4");
              dmr4.field = "C";
              dmr4.accountId = "2";
              simpleDao.save(dmr4).then(() => {
                done();
              });
            });
          });
        });
      });

      it("should not return values", (done) => {
        const promise = simpleDao.for(DataMapResult).distinct();
        promise.then((results) => {
          expect(results).to.be.an("array");
          expect(results.length).to.be.eql(0);
          done();
        }).catch((err) => { done(err); });
      });

      it("should return the distinct values for field with no query", (done) => {
        const promise = simpleDao.for(DataMapResult).distinct("field");
        promise.then((results) => {
          expect(results).to.be.an("array");
          expect(results.length).to.be.eql(3);
          expect(results[0]).to.be.eql("A");
          expect(results[1]).to.be.eql("B");
          expect(results[2]).to.be.eql("C");
          done();
        }).catch((err) => { done(err); });
      });

      it("should return the distinct values for the field with the given query", (done) => {
        const query = {accountId: "1"};
        const promise = simpleDao.for(DataMapResult).distinct("field", query);
        promise.then((results) => {
          expect(results).to.be.an("array");
          expect(results.length).to.be.eql(2);
          expect(results[0]).to.be.eql("A");
          expect(results[1]).to.be.eql("B");
          done();
        }).catch((err) => { done(err); });
      });
    });

    describe(".remove()", () => {
      const dataMapId = "something";
      const dmr1 = new DataMapResult(dataMapId);
      const dmr2 = new DataMapResult(dataMapId);
      const dmr3 = new DataMapResult("another");

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
          simpleDao.save(dmr3)
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
          simpleDao.save(dmr3)
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
});
