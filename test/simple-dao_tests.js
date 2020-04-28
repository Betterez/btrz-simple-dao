// eslint-disable-next-line max-statements
describe("SimpleDao", () => {
  const Chance = require("chance");
  const chance = new Chance();
  const {
    ObjectID, MongoClient, Cursor
  } = require("mongodb");
  const chai = require("chai");
  const expect = chai.expect;
  const chaiAsPromised = require("chai-as-promised");
  chai.use(chaiAsPromised);
  const sinon = require("sinon");
  const sandbox = sinon.createSandbox();
  const {
    ALL_AUTH_MECHANISMS, ALL_READ_PREFERENCES
  } = require("../constants");
  const SimpleDao = require("../").SimpleDao;
  const {
    getConnectionString
  } = require("../src/simple-dao");


  async function databaseHasCollection(db, collectionName) {
    const allCollections = await db.listCollections().toArray();
    return allCollections.some((collection) => {
      return collection.name === collectionName;
    });
  }

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

  async function expectDocumentDoesNotExist(id, _collectionName = collectionName) {
    const db = await simpleDao.connect();
    const document = await db.collection(_collectionName).findOne({_id: id});
    expect(document).to.not.exist;
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
    } catch (err) {
      // ignore error
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
      expect(connectionString).to.eql("mongodb://127.0.0.1:27017/simple_dao_test");
    });

    it("should not include an authentication mechanism if no username or pwd", () => {
      const connectionString = getConnectionString(config.db);
      expect(connectionString).to.eql("mongodb://127.0.0.1:27017/simple_dao_test");
    });

    it("should return a valid connection string for one db server using authentication credentials", () => {
      const config2 = {
        db: {
          options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd"
          },
          uris: ["127.0.0.1:27017"]
        }
      };
      const connectionString = getConnectionString(config2.db);
      expect(connectionString).to.eql("mongodb://usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT");
    });

    it("should URL-encode the authentication credentials " +
      "so that credentials that include symbols will not result in invalid connection strings", () => {
      const config2 = {
        db: {
          options: {
            database: "simple_dao_test",
            username: "u$ername",
            password: "pa$$w{}rd"
          },
          uris: ["127.0.0.1:27017"]
        }
      };
      const connectionString = getConnectionString(config2.db);
      expect(connectionString)
        .to.eql("mongodb://u%24ername:pa%24%24w%7B%7Drd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT");
    });

    it("should return a valid connection string for many db servers using authentication credentials", () => {
      const config2 = {
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
      const connectionString = getConnectionString(config2.db);
      expect(connectionString).to.eql("mongodb://usr:pwd@127.0.0.1:27017,127.0.0.2:27018/simple_dao_test?authMechanism=DEFAULT");
    });

    it("should return a valid connection string that includes the specified authentication mechanism", () => {
      for (const authMechanism of ALL_AUTH_MECHANISMS) {
        const config2 = {
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
        const connectionString = getConnectionString(config2.db);
        expect(connectionString).to.eql(`mongodb://usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=${authMechanism}`);
      }
    });

    it("should throw an error if an invalid authentication mechanism is specified", () => {
      const config2 = {
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
      expect(() => {
        return getConnectionString(config2.db);
      })
        .to.throw("Database config 'authMechanism' must be one of DEFAULT, MONGODB-CR, SCRAM-SHA-1, SCRAM-SHA-256");
    });

    it("should return a valid connection string that includes the specified read preference", () => {
      for (const readPreference of ALL_READ_PREFERENCES) {
        const config2 = {
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
        const connectionString = getConnectionString(config2.db);
        expect(connectionString)
          .to.eql(`mongodb://usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT&readPreference=${readPreference}`);
      }
    });

    it("should throw an error if an invalid read preference is specified", () => {
      const config2 = {
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
      expect(() => {
        return getConnectionString(config2.db);
      }).to.throw("When specified, database config 'readPreference' " +
        "must be one of primary, primaryPreferred, secondary, secondaryPreferred, nearest");
    });

    it("should return a valid connection string that includes the specified replica set name", () => {
      const config2 = {
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
      const connectionString = getConnectionString(config2.db);
      expect(connectionString)
        .to.eql(`mongodb://usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT&replicaSet=${config2.db.options.replicaSet}`);
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

    it("should connect to the database and return an object that allows operations on the specified database", async () => {
      console.log(simpleDao.connectionString);
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
      const client = await simpleDao2._getMongoClient();
      await client.close();

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

    it("should allow writing files", () => {
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
        gs.open((_err, _gsx) => {
          gs.seek(0, () => {
            gs.read((_err2, readData) => {
              expect(data.toString("base64")).to.eq(readData.toString("base64"));
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
      gridStore.open((_err, gridStore1) => {
        gridStore1.write(data, (_err2, gridStore2) => {
          gridStore2.close((_err3, _result) => {
            return simpleDao.connect().then((db2) => {
              db2.gridfs().open(fileName, "r", (_err4, gs) => {
                gs.read((_err5, readData) => {
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

  describe(".collectionNames()", () => {
    let db = null;

    beforeEach(async () => {
      db = await simpleDao.connect();
      await db.dropDatabase();
    });

    it("should return an empty array if there are no collections in the database", async () => {
      const collectionNames = await simpleDao.collectionNames();
      expect(collectionNames).to.eql([]);
    });

    it("should return a list of all collection names in the database", async () => {
      await db.collection("collection_1").insert({});
      await db.collection("collection_2").insert({});
      const collectionNames = await simpleDao.collectionNames();
      expect(collectionNames).to.be.an("array").that.includes.members(["collection_1", "collection_2"]);
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
      expect(() => {
        simpleDao.for({});
      }).to.throw("SimpleDao: The provided constructor function or class needs to have a factory function");
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
    let modelOne = null;
    let modelTwo = null;
    let modelThree = null;

    beforeEach(async () => {
      modelOne = Model.factory({a: 1});
      modelTwo = Model.factory({a: 2});
      modelThree = Model.factory({a: 2});

      await Promise.all([
        simpleDao.save(modelOne),
        simpleDao.save(modelTwo),
        simpleDao.save(modelThree)
      ]);
    });

    describe(".count()", () => {
      it("should return the number of records that match the specified query", async () => {
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
          let results = await simpleDao.for(Model).find({a: {$gt: 0}}).toArray();
          expect(results).to.have.length(3);

          results = await simpleDao.for(Model).find({a: 1}).toArray();
          expect(results).to.have.length(1);
        });

        it("should return an array of objects that are instances of the provided class, " +
          "created via the class' .factory() method", async () => {
          const factorySpy = sandbox.spy(Model, "factory");
          expect(factorySpy.callCount).to.eql(0);

          const results = await simpleDao.for(Model).find({}).toArray();
          expect(results).to.have.length.gt(0);
          expect(factorySpy.callCount).to.eql(results.length);

          for (const data of results) {
            expect(data).to.be.an.instanceOf(Model);
          }
        });

        it("should reject if there was an error performing the query", async () => {
          return expect(simpleDao.for(Model).find({a: {$badOperator: 0}}).toArray()).to.eventually.be.rejectedWith("unknown operator");
        });
      });

      describe(".toCursor()", () => {
        it("should return a cursor for all documents that match the specified query", async () => {
          const cursor = await simpleDao.for(Model).find({a: {$gt: 0}}).toCursor();
          expect(cursor).to.be.an.instanceOf(Cursor);

          const results = await cursor.toArray();
          expect(results).to.have.length(3);
        });
      });
    });

    describe(".findOne()", () => {
      it("should return only one object that matches the specified query", async () => {
        const result = await simpleDao.for(Model).findOne({a: 2});
        expect(result).to.exist;
        expect(result.a).to.eql(2);
      });

      it("should return null if there is no document matching the specified query", async () => {
        const result = await simpleDao.for(Model).findOne({a: 3});
        expect(result).to.eql(null);
      });

      it("should return an object that is an instance of the provided class, created via the class' .factory() method", async () => {
        const factorySpy = sandbox.spy(Model, "factory");
        expect(factorySpy.callCount).to.eql(0);

        const result = await simpleDao.for(Model).findOne({});
        expect(result).to.exist;
        expect(result).to.be.an.instanceOf(Model);
        expect(factorySpy.callCount).to.eql(1);
      });

      it("should reject if there was an error performing the query", async () => {
        return expect(simpleDao.for(Model).findOne({a: {$badOperator: 0}})).to.eventually.be.rejectedWith("unknown operator");
      });
    });

    describe(".findById()", () => {
      context("when the provided 'id' is an Object ID", () => {
        it("should return the single object that has the specified id", async () => {
          const result = await simpleDao.for(Model).findById(modelOne._id);
          expect(result).to.exist;
          expect(result._id.toString()).to.eql(modelOne._id.toString());
        });
      });

      context("when the provided 'id' is a string", () => {
        it("should return the single object that has the specified id", async () => {
          const result = await simpleDao.for(Model).findById(modelOne._id.toString());
          expect(result).to.exist;
          expect(result._id.toString()).to.eql(modelOne._id.toString());
        });

        it("should reject if the provided string is not a valid Object ID", async () => {
          return expect(simpleDao.for(Model).findById("1")).to.eventually.be
            .rejectedWith("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");
        });
      });

      it("should return an object that is an instance of the provided class, created via the class' .factory() method", async () => {
        const factorySpy = sandbox.spy(Model, "factory");
        expect(factorySpy.callCount).to.eql(0);

        const result = await simpleDao.for(Model).findById(modelOne._id);
        expect(result).to.exist;
        expect(result).to.be.an.instanceOf(Model);
        expect(factorySpy.callCount).to.eql(1);
      });

      it("should return null if there is no document with the specified id", async () => {
        const result = await simpleDao.for(Model).findById(new ObjectID());
        expect(result).to.eql(null);
      });
    });

    describe(".findAggregate()", () => {
      describe(".toArray()", () => {
        it("should return an array of all documents produced by the specified aggregate query", async () => {
          const query = {$group: {_id: 1, total: {$sum: "$a"}}};
          const result = await simpleDao.for(Model).findAggregate(query).toArray();
          expect(result).to.deep.eql([{_id: 1, total: 5}]);
        });

        it("should return an array of objects that are instances of the provided class, " +
          "created via the class' .factory() method", async () => {
          const factorySpy = sandbox.spy(Model, "factory");
          expect(factorySpy.callCount).to.eql(0);

          const results = await simpleDao.for(Model).findAggregate({$group: {_id: 1, total: {$sum: "$a"}}}).toArray();
          expect(results).to.have.length.gt(0);
          expect(factorySpy.callCount).to.eql(results.length);

          for (const data of results) {
            expect(data).to.be.an.instanceOf(Model);
          }
        });

        it("should reject if there was an error performing the query", async () => {
          return expect(simpleDao.for(Model).findAggregate({a: {$badOperator: 0}}).toArray())
            .to.eventually.be.rejectedWith("Unrecognized pipeline stage name");
        });
      });

      describe(".toCursor()", () => {
        it("should return a cursor for all documents produced by the specified aggregate query", async () => {
          const cursor = await simpleDao.for(Model).findAggregate({$match: {a: {$gt: 0}}}).toCursor();
          expect(cursor.constructor.name).to.eql("AggregationCursor");

          const results = await cursor.toArray();
          expect(results).to.have.length(3);
        });
      });
    });

    describe(".update()", () => {
      it("should reject if no query is provided", async () => {
        return expect(simpleDao.for(Model).update()).to.be.rejectedWith("query can't be undefined or null");
      });

      it("should reject if no update parameter is provided", async () => {
        return expect(simpleDao.for(Model).update({})).to.be.rejectedWith("Error: update can't be undefined or null");
      });

      it("should update only one document by default", async () => {
        const result = await simpleDao.for(Model).update({}, {$set: {a: 5}});
        expect(result).to.deep.eql({n: 1, nModified: 1, ok: 1, updatedExisting: true});
      });

      it("should update multiple documents when the `multi: true` option is provided", async () => {
        const result = await simpleDao.for(Model).update({}, {$set: {a: 5}}, {multi: true});
        expect(result).to.deep.eql({n: 3, nModified: 3, ok: 1, updatedExisting: true});
      });

      it("should not update anything if the provided query matches no documents", async () => {
        const result = await simpleDao.for(Model).update({b: 1}, {$set: {a: 5}});
        expect(result).to.deep.eql({n: 0, nModified: 0, ok: 1, updatedExisting: false});
      });

      it("should reject if the update operation is invalid", async () => {
        return expect(simpleDao.for(Model).update({b: 1}, {$badOperator: {a: 5}}))
          .to.be.rejectedWith("Unknown modifier");
      });

      it("should reject if an error was encountered when connecting to the database", async () => {
        sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
        await expect(simpleDao.for(Model).update({}, {$set: {a: 5}})).to.eventually.be.rejectedWith("Some connection error");
      });
    });

    describe(".remove()", () => {
      it("should remove all documents that match the provided query", async () => {
        const db = await simpleDao.connect();

        const query = {a: 2};
        const documentsPriorToRemoval = await db.collection(collectionName).find(query).toArray();
        expect(documentsPriorToRemoval).to.have.length(2);

        const result = await simpleDao.for(Model).remove(query);
        expect(result).to.deep.eql({n: 2, ok: 1});

        const documentsAfterRemoval = await db.collection(collectionName).find(query).toArray();
        expect(documentsAfterRemoval.length).to.eql(0);
      });

      it("should remove no documents if the provided query matches no documents", async () => {
        const db = await simpleDao.connect();

        const allDocumentsInCollectionPriorToRemoval = await db.collection(collectionName).find({}).toArray();
        expect(allDocumentsInCollectionPriorToRemoval).to.have.length(3);

        const query = {a: 5};
        const result = await simpleDao.for(Model).remove(query);
        expect(result).to.deep.eql({n: 0, ok: 1});

        const allDocumentsInCollectionAfterRemoval = await db.collection(collectionName).find({}).toArray();
        expect(allDocumentsInCollectionAfterRemoval.length).to.eql(3);
      });

      it("should reject if no query is provided", async () => {
        return expect(simpleDao.for(Model).remove()).to.be.rejectedWith("query can't be undefined or null");
      });

      it("should reject if the query is invalid", async () => {
        return expect(simpleDao.for(Model).remove({$badOperator: 1}))
          .to.be.rejectedWith("unknown top level operator");
      });

      it("should reject if an error was encountered when connecting to the database", async () => {
        sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
        await expect(simpleDao.for(Model).remove({})).to.eventually.be.rejectedWith("Some connection error");
      });
    });

    describe(".removeById()", () => {
      context("when the provided 'id' is an Object ID", () => {
        it("should remove the single document that has the specified id", async () => {
          const result = await simpleDao.for(Model).removeById(modelOne._id);
          expect(result).to.deep.eql({n: 1, ok: 1});
          await expectDocumentDoesNotExist(modelOne._id);
        });
      });

      context("when the provided 'id' is a string", () => {
        it("should remove the single document that has the specified id", async () => {
          const result = await simpleDao.for(Model).removeById(modelOne._id.toString());
          expect(result).to.deep.eql({n: 1, ok: 1});
          await expectDocumentDoesNotExist(modelOne._id);
        });

        it("should reject if the provided string is not a valid Object ID", async () => {
          return expect(simpleDao.for(Model).removeById("1")).to.eventually.be
            .rejectedWith("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");
        });
      });

      it("should do nothing if there is no document with the specified id", async () => {
        const result = await simpleDao.for(Model).removeById(new ObjectID());
        expect(result).to.deep.eql({n: 0, ok: 1});
      });
    });

    describe(".distinct()", () => {
      it("should return an empty array when no field is provided", async () => {
        const results = await simpleDao.for(Model).distinct();
        expect(results).to.deep.eql([]);
      });

      it("should return all distinct values for the provided field when no query is specified", async () => {
        const results = await simpleDao.for(Model).distinct("a");
        expect(results).to.be.an("array").that.includes.members([1, 2]);
      });

      it("should return the distinct values for the provided field amongst all documents that match the provided query", async () => {
        const modelFour = Model.factory({a: 3});
        await simpleDao.save(modelFour);
        const results = await simpleDao.for(Model).distinct("a", {a: {$gt: 1}});
        expect(results).to.be.an("array").that.includes.members([2, 3]);
      });

      it("should reject if the query is invalid", async () => {
        return expect(simpleDao.for(Model).distinct("a", {$badOperator: 1}))
          .to.be.rejectedWith("unknown top level operator");
      });

      it("should reject if an error was encountered when connecting to the database", async () => {
        sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
        await expect(simpleDao.for(Model).distinct("a")).to.eventually.be.rejectedWith("Some connection error");
      });
    });
  });
});
