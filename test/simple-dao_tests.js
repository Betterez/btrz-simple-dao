const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert").strict;
const { deepEqual } = require("node:assert");

// eslint-disable-next-line max-statements
describe("SimpleDao", () => {
  const Chance = require("chance");
  const chance = new Chance();
  const {
    ObjectID, MongoClient, Cursor
  } = require("mongodb");
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
    assert.ok(document == null);
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
        assert.ok(SimpleDao.objectId() instanceof ObjectID);
      });

      it("should return an objectId from the given 24 characters argument", () => {
        const id = "55b27c2a74757b3c5e121b0e";
        deepEqual(SimpleDao.objectId(id).toString(), id);
      });
    });

    describe("instance method", () => {
      it("should return a new objectId", () => {
        assert.ok(simpleDao.objectId() instanceof ObjectID);
      });

      it("should return an objectId from the given 24 characters argument", () => {
        const id = "55b27c2a74757b3c5e121b0e";
        deepEqual(simpleDao.objectId(id).toString(), id);
      });
    });
  });

  describe("getConnectionString()", () => {
    it("should return a valid connection string for one db server", () => {
      const connectionString = getConnectionString(config.db);
      deepEqual(connectionString, "mongodb://127.0.0.1:27017/simple_dao_test");
    });

    it("should not include an authentication mechanism if no username or pwd", () => {
      const connectionString = getConnectionString(config.db);
      deepEqual(connectionString, "mongodb://127.0.0.1:27017/simple_dao_test");
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
      deepEqual(connectionString, "mongodb://usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT");
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
      deepEqual(connectionString, "mongodb://u%24ername:pa%24%24w%7B%7Drd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT");
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
      deepEqual(connectionString, "mongodb://usr:pwd@127.0.0.1:27017,127.0.0.2:27018/simple_dao_test?authMechanism=DEFAULT");
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
        deepEqual(connectionString, `mongodb://usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=${authMechanism}`);
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
      assert.throws(() => getConnectionString(config2.db), {
        message: "Database config 'authMechanism' must be one of DEFAULT, MONGODB-CR, SCRAM-SHA-1, SCRAM-SHA-256"
      });
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
        deepEqual(connectionString, `mongodb://usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT&readPreference=${readPreference}`);
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
      assert.throws(() => getConnectionString(config2.db), {
        message: "When specified, database config 'readPreference' " +
        "must be one of primary, primaryPreferred, secondary, secondaryPreferred, nearest"
      });
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
      deepEqual(connectionString, `mongodb://usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT&replicaSet=${config2.db.options.replicaSet}`);
    });

    it("should return a valid connection string that includes the authentication source and if ssl", () => {
      const config2 = {
        db: {
          options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd",
            replicaSet: "replica_set_name",
            authSource: "admin",
            ssl: true
          },
          uris: [
            "host1:1024",
            "host1:1025"
          ]
        }
      };
      const connectionString = getConnectionString(config2.db);
      deepEqual(connectionString, "mongodb://usr:pwd@host1:1024,host1:1025/simple_dao_test?authMechanism=DEFAULT&replicaSet=replica_set_name&authSource=admin&ssl=true");
    });

    it("should return a valid connection string that includes the SRV record", () => {
      const config2 = {
        db: {
          options: {
            database: "simple_dao_test",
            username: "usr",
            password: "pwd",
            useSRVRecord: true
          },
          uris: ["127.0.0.1:27017"]
        }
      };
      const connectionString = getConnectionString(config2.db);
      deepEqual(connectionString, "mongodb+srv://usr:pwd@127.0.0.1:27017/simple_dao_test?authMechanism=DEFAULT");
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
      deepEqual(db.databaseName, config.db.options.database);
      const result = await db.collection("test_collection").insertOne({test: true});
      const _id = result.insertedId;
      const [insertedDocument] = await db.collection("test_collection").find({_id}).toArray();
      assert.strictEqual(insertedDocument.test, true);
    });

    it("should share database connections across multiple instances of the SimpleDao " +
      "when a connection to a particular database has already been established", async () => {
      const connectionSpy = sandbox.spy(MongoClient, "connect");

      assert.strictEqual(connectionSpy.callCount, 0);
      const simpleDao2 = new SimpleDao(configForOtherDatabase);
      const db2 = await simpleDao2.connect();
      assert.strictEqual(connectionSpy.callCount, 1);

      // Create a new instance of the SimpleDao and connect to the database again.
      // Since we already connected to this database in the previous instance, we expect that connection to be re-used.
      const simpleDao3 = new SimpleDao(configForOtherDatabase);
      const db3 = await simpleDao3.connect();
      assert.strictEqual(db3 === db2, true);
      assert.strictEqual(connectionSpy.callCount, 1);

      // Change which database we are connecting to
      configForOtherDatabase.db.options.database = "simple_dao_test_3";

      // Create a new instance.  We expect it to form a new connection, since we haven't connected to this database yet.
      const simpleDao4 = new SimpleDao(configForOtherDatabase);
      const db4 = await simpleDao4.connect();
      assert.strictEqual(db4 === db3, false);
      assert.strictEqual(connectionSpy.callCount, 2);

      // Create another instance, which should re-use the connection from the previous instance
      const simpleDao5 = new SimpleDao(configForOtherDatabase);
      const db5 = await simpleDao5.connect();
      assert.strictEqual(db5 === db4, true);
      assert.strictEqual(connectionSpy.callCount, 2);
    });

    it("should automatically reconnect when the database connection was unexpectedly closed", async () => {
      // Change which database we are connecting to
      configForOtherDatabase.db.options.database = "simple_dao_test_4";

      const connectionSpy = sandbox.spy(MongoClient, "connect");

      assert.strictEqual(connectionSpy.callCount, 0);
      const simpleDao2 = new SimpleDao(configForOtherDatabase);
      const dbConnection2 = await simpleDao2.connect();
      assert.strictEqual(connectionSpy.callCount, 1);

      // Close the database connection.
      // The next time we try to connect, we expect the simpleDao to form a new connection to the database.
      const client = await simpleDao2._getMongoClient();
      await client.close();

      const dbConnection3 = await simpleDao2.connect();
      assert.strictEqual(dbConnection2 === dbConnection3, false);
      assert.strictEqual(connectionSpy.callCount, 2);
    });

    it("should reconnect on subsequent calls after the initial connection rejects with an error", async () => {
      // Change which database we are connecting to
      configForOtherDatabase.db.options.database = "simple_dao_test_5";

      const connectionStub = sandbox.stub(MongoClient, "connect").rejects(new Error("Some mongo error"));

      assert.strictEqual(connectionStub.callCount, 0);
      const simpleDao2 = new SimpleDao(configForOtherDatabase);
      try {
        await simpleDao2.connect();
        assert.fail();
      } catch (err) {
        assert.strictEqual(err.message, "Some mongo error");
        assert.strictEqual(connectionStub.callCount, 1);
      }

      // Allow the database connection to proceed normally, without rejection.
      // We expect the simpleDao to form a new connection to the database.
      connectionStub.reset();
      assert.strictEqual(connectionStub.callCount, 0);
      connectionStub.callThrough();
      await simpleDao2.connect();
      assert.strictEqual(connectionStub.callCount, 1);
    });

    it("should connect to the database only once when multiple database requests arrive while the initial connection is still being " +
      "established", async () => {
      // Change which database we are connecting to
      configForOtherDatabase.db.options.database = "simple_dao_test_6";
      const simpleDao2 = new SimpleDao(configForOtherDatabase);

      const connectionSpy = sandbox.spy(MongoClient, "connect");
      assert.strictEqual(connectionSpy.callCount, 0);

      await Promise.all([
        simpleDao2.for(Model).find({}),
        simpleDao2.for(Model).find({}),
        simpleDao2.for(Model).find({})
      ]);

      assert.strictEqual(connectionSpy.callCount, 1);
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
            reject(err);
            return;
          }
          gs.write(data, (err2) => {
            if (err2) {
              reject(err2);
              return;
            }
            gs.close((err3) => {
              if (err3) {
                reject(err3);
                return;
              }
              resolve();
            });
          });
        });
      }).then(() => new Promise((resolve, reject) => {
        const gs = new GridStore(db, fileName, "r");
        gs.open((errOpen) => {
          if (errOpen) {
            reject(errOpen);
            return;
          }
          gs.seek(0, (errSeek) => {
            if (errSeek) {
              reject(errSeek);
              return;
            }
            gs.read((errRead, readData) => {
              if (errRead) {
                reject(errRead);
                return;
              }
              assert.strictEqual(data.toString("base64"), readData.toString("base64"));
              resolve();
            });
          });
        });
      }));
    });

    it("should allow reading files", () => {
      const fileName = "tintin";
      const path = "test/fixtures/tintin.jpg";
      const data = require("fs").readFileSync(path);

      return new Promise((resolve, reject) => {
        const gridStore = new GridStore(db, fileName, "w");
        gridStore.open((err, gridStore1) => {
          if (err) {
            reject(err);
            return;
          }
          gridStore1.write(data, (err2, gridStore2) => {
            if (err2) {
              reject(err2);
              return;
            }
            gridStore2.close((err3) => {
              if (err3) {
                reject(err3);
                return;
              }
              simpleDao.connect().then((db2) => {
                db2.gridfs().open(fileName, "r", (err4, gs) => {
                  if (err4) {
                    reject(err4);
                    return;
                  }
                  gs.read((err5, readData) => {
                    if (err5) {
                      reject(err5);
                      return;
                    }
                    assert.strictEqual(data.toString("base64"), readData.toString("base64"));
                    resolve();
                  });
                });
              }).catch(reject);
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
      deepEqual(collectionNames, []);
    });

    it("should return a list of all collection names in the database", async () => {
      await db.collection("collection_1").insert({});
      await db.collection("collection_2").insert({});
      const collectionNames = await simpleDao.collectionNames();
      assert.ok(Array.isArray(collectionNames));
      assert.ok(collectionNames.includes("collection_1"));
      assert.ok(collectionNames.includes("collection_2"));
    });
  });

  describe(".dropCollection()", () => {
    it("should drop the specified collection", async () => {
      const db = await simpleDao.connect();
      let collectionExists = await databaseHasCollection(db, collectionName);
      assert.strictEqual(collectionExists, false);

      await simpleDao.save(model);
      collectionExists = await databaseHasCollection(db, collectionName);
      assert.strictEqual(collectionExists, true);

      await simpleDao.dropCollection(collectionName);
      collectionExists = await databaseHasCollection(db, collectionName);
      assert.strictEqual(collectionExists, false);
    });
  });

  describe(".for()", () => {
    it("should return an Operator with the correct properties", () => {
      const operator = simpleDao.for(Model);
      assert.strictEqual(operator.simpleDao, simpleDao);
      deepEqual(operator.collectionName, Model.collectionName());
      assert.strictEqual(operator.factory, Model.factory);
    });

    it("should throw an error if the provided constructor function does not have a 'factory' method", () => {
      assert.throws(() => simpleDao.for({}), {
        message: "SimpleDao: The provided constructor function or class needs to have a factory function"
      });
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
      assert.strictEqual(cursor.constructor.name, "AggregationCursor");
      const result = await cursor.toArray();
      deepEqual(result, [{_id: 1, total: 3}]);
    });

    it("should reject if an error was encountered when connecting to the database", async () => {
      sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
      try {
        await simpleDao.aggregate(collectionName, {});
        assert.fail("expected rejection");
      } catch (err) {
        assert.strictEqual(err.message, "Some connection error");
      }
    });
  });

  describe(".save()", () => {
    it("should save the model to the correct collection, as defined by the model constructor's `collectionName()` function", async () => {
      const db = await simpleDao.connect();
      let allDocumentsInCollection = await db.collection(model.constructor.collectionName()).find({}).toArray();
      assert.strictEqual(allDocumentsInCollection.length, 0);

      await simpleDao.save(model);
      allDocumentsInCollection = await db.collection(model.constructor.collectionName()).find({}).toArray();
      assert.strictEqual(allDocumentsInCollection.length, 1);
      assert.strictEqual(allDocumentsInCollection[0]._id.toString(), model._id.toString());
    });

    it("should return the model", async () => {
      const result = await simpleDao.save(model);
      Reflect.deleteProperty(result, "_id");
      deepEqual(result, model);
    });

    it("should reject if a model is not provided", async () => {
      try {
        await simpleDao.save();
        assert.fail("expected rejection");
      } catch (err) {
        assert.strictEqual(err.message, "SimpleDao: No data was provided in the call to .save()");
      }
    });

    it("should mutate the model and assign the _id from the saved db document when the original model doesn't have an _id", async () => {
      assert.ok(model._id == null);
      await simpleDao.save(model);
      assert.ok(model._id != null);
      assert.ok(model._id instanceof ObjectID);
    });

    it("should save the model with its existing _id when the model is provided with an _id", async () => {
      const _id = ObjectID();
      model._id = _id;
      await simpleDao.save(model);
      assert.strictEqual(model._id.toString(), _id.toString());
    });

    it("should mutate the model and set the value of 'model.updatedAt.value' to the current date, " +
      "when the model has an 'updatedAt.value' property", async () => {
      assert.ok(model.updatedAt == null);

      await simpleDao.save(model);
      assert.ok(model.updatedAt == null);

      model.updatedAt = {};
      await simpleDao.save(model);
      assert.ok(model.updatedAt.value == null);

      model.updatedAt = {value: "some value"};
      await simpleDao.save(model);
      assert.ok(model.updatedAt.value != null);
      assert.ok(model.updatedAt.value instanceof Date);
      // Check that the updatedAt timestamp is within 10 seconds of now
      const currentTimestamp = new Date().getTime();
      assert.ok(model.updatedAt.value.getTime() >= currentTimestamp - 10000 && model.updatedAt.value.getTime() <= currentTimestamp + 10000);
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
        assert.strictEqual(count, 1);

        count = await simpleDao.for(Model).count({a: 2});
        assert.strictEqual(count, 2);
      });

      it("should reject if an error was encountered when connecting to the database", async () => {
        sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
        try {
          await simpleDao.for(Model).count({});
          assert.fail("expected rejection");
        } catch (err) {
          assert.strictEqual(err.message, "Some connection error");
        }
      });
    });

    describe(".find()", () => {
      describe(".toArray()", () => {
        it("should return an array of all documents that match the specified query", async () => {
          let results = await simpleDao.for(Model).find({a: {$gt: 0}}).toArray();
          assert.strictEqual(results.length, 3);

          results = await simpleDao.for(Model).find({a: 1}).toArray();
          assert.strictEqual(results.length, 1);
        });

        it("should return an array of objects that are instances of the provided class, " +
          "created via the class' .factory() method", async () => {
          const factorySpy = sandbox.spy(Model, "factory");
          assert.strictEqual(factorySpy.callCount, 0);

          const results = await simpleDao.for(Model).find({}).toArray();
          assert.ok(results.length > 0);
          assert.strictEqual(factorySpy.callCount, results.length);

          for (const data of results) {
            assert.ok(data instanceof Model);
          }
        });

        it("should reject if there was an error performing the query", async () => {
          try {
            await simpleDao.for(Model).find({a: {$badOperator: 0}}).toArray();
            assert.fail("expected rejection");
          } catch (err) {
            assert.strictEqual(err.message, "unknown operator: $badOperator");
          }
        });
      });

      describe(".toCursor()", () => {
        it("should return a cursor for all documents that match the specified query", async () => {
          const cursor = await simpleDao.for(Model).find({a: {$gt: 0}}).toCursor();
          assert.ok(cursor instanceof Cursor);

          const results = await cursor.toArray();
          assert.strictEqual(results.length, 3);
        });
      });
    });

    describe(".findOne()", () => {
      it("should return only one object that matches the specified query", async () => {
        const result = await simpleDao.for(Model).findOne({a: 2});
        assert.ok(result != null);
        assert.strictEqual(result.a, 2);
      });

      it("should return null if there is no document matching the specified query", async () => {
        const result = await simpleDao.for(Model).findOne({a: 3});
        assert.strictEqual(result, null);
      });

      it("should return an object that is an instance of the provided class, created via the class' .factory() method", async () => {
        const factorySpy = sandbox.spy(Model, "factory");
        assert.strictEqual(factorySpy.callCount, 0);

        const result = await simpleDao.for(Model).findOne({});
        assert.ok(result != null);
        assert.ok(result instanceof Model);
        assert.strictEqual(factorySpy.callCount, 1);
      });

      it("should reject if there was an error performing the query", async () => {
        try {
          await simpleDao.for(Model).findOne({a: {$badOperator: 0}});
          assert.fail("expected rejection");
        } catch (err) {
          assert.ok(err.message.includes("unknown operator"));
        }
      });
    });

    describe(".findById()", () => {
      describe("when the provided 'id' is an Object ID", () => {
        it("should return the single object that has the specified id", async () => {
          const result = await simpleDao.for(Model).findById(modelOne._id);
          assert.ok(result != null);
          assert.strictEqual(result._id.toString(), modelOne._id.toString());
        });
      });

      describe("when the provided 'id' is a string", () => {
        it("should return the single object that has the specified id", async () => {
          const result = await simpleDao.for(Model).findById(modelOne._id.toString());
          assert.ok(result != null);
          assert.strictEqual(result._id.toString(), modelOne._id.toString());
        });

        it("should reject if the provided string is not a valid Object ID", async () => {
          try {
            await simpleDao.for(Model).findById("1");
            assert.fail("expected rejection");
          } catch (err) {
            assert.strictEqual(err.message, "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");
          }
        });
      });

      it("should return an object that is an instance of the provided class, created via the class' .factory() method", async () => {
        const factorySpy = sandbox.spy(Model, "factory");
        assert.strictEqual(factorySpy.callCount, 0);

        const result = await simpleDao.for(Model).findById(modelOne._id);
        assert.ok(result != null);
        assert.ok(result instanceof Model);
        assert.strictEqual(factorySpy.callCount, 1);
      });

      it("should return null if there is no document with the specified id", async () => {
        const result = await simpleDao.for(Model).findById(new ObjectID());
        assert.strictEqual(result, null);
      });
    });

    describe(".findAggregate()", () => {
      describe(".toArray()", () => {
        it("should return an array of all documents produced by the specified aggregate query", async () => {
          const query = {$group: {_id: 1, total: {$sum: "$a"}}};
          const result = await simpleDao.for(Model).findAggregate(query).toArray();
          deepEqual(result, [{_id: 1, total: 5}]);
        });

        it("should return an array of objects that are instances of the provided class, " +
          "created via the class' .factory() method", async () => {
          const factorySpy = sandbox.spy(Model, "factory");
          assert.strictEqual(factorySpy.callCount, 0);

          const results = await simpleDao.for(Model).findAggregate({$group: {_id: 1, total: {$sum: "$a"}}}).toArray();
          assert.ok(results.length > 0);
          assert.strictEqual(factorySpy.callCount, results.length);

          for (const data of results) {
            assert.ok(data instanceof Model);
          }
        });

        it("should reject if there was an error performing the query", async () => {
          try {
            await simpleDao.for(Model).findAggregate({a: {$badOperator: 0}}).toArray();
            assert.fail("expected rejection");
          } catch (err) {
            assert.strictEqual(err.message, "Unrecognized pipeline stage name: 'a'");
          }
        });
      });

      describe(".toCursor()", () => {
        it("should return a cursor for all documents produced by the specified aggregate query", async () => {
          const cursor = await simpleDao.for(Model).findAggregate({$match: {a: {$gt: 0}}}).toCursor();
          assert.strictEqual(cursor.constructor.name, "AggregationCursor");

          const results = await cursor.toArray();
          assert.strictEqual(results.length, 3);
        });
      });
    });

    describe(".update()", () => {
      it("should reject if no query is provided", async () => {
        try {
          await simpleDao.for(Model).update();
          assert.fail("expected rejection");
        } catch (err) {
          assert.strictEqual(err.message, "query can't be undefined or null");
        }
      });

      it("should reject if no update parameter is provided", async () => {
        try {
          await simpleDao.for(Model).update({});
          assert.fail("expected rejection");
        } catch (err) {
          assert.strictEqual(err.message, "update can't be undefined or null");
        }
      });

      it("should update only one document by default", async () => {
        const result = await simpleDao.for(Model).update({}, {$set: {a: 5}});
        deepEqual(result, {n: 1, nModified: 1, ok: 1, updatedExisting: true});
      });

      it("should update multiple documents when the `multi: true` option is provided", async () => {
        const result = await simpleDao.for(Model).update({}, {$set: {a: 5}}, {multi: true});
        deepEqual(result, {n: 3, nModified: 3, ok: 1, updatedExisting: true});
      });

      it("should not update anything if the provided query matches no documents", async () => {
        const result = await simpleDao.for(Model).update({b: 1}, {$set: {a: 5}});
        deepEqual(result, {n: 0, nModified: 0, ok: 1, updatedExisting: false});
      });

      it("should reject if the update operation is invalid", async () => {
        try {
          await simpleDao.for(Model).update({b: 1}, {$badOperator: {a: 5}});
          assert.fail("expected rejection");
        } catch (err) {
          assert.strictEqual(err.message, "Unknown modifier: $badOperator. Expected a valid update modifier or pipeline-style update specified as an array");
        }
      });

      it("should reject if an error was encountered when connecting to the database", async () => {
        sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
        try {
          await simpleDao.for(Model).update({}, {$set: {a: 5}});
          assert.fail("expected rejection");
        } catch (err) {
          assert.strictEqual(err.message, "Some connection error");
        }
      });
    });

    describe(".remove()", () => {
      it("should remove all documents that match the provided query", async () => {
        const db = await simpleDao.connect();

        const query = {a: 2};
        const documentsPriorToRemoval = await db.collection(collectionName).find(query).toArray();
        assert.strictEqual(documentsPriorToRemoval.length, 2);

        const result = await simpleDao.for(Model).remove(query);
        deepEqual(result, {n: 2, ok: 1});

        const documentsAfterRemoval = await db.collection(collectionName).find(query).toArray();
        assert.strictEqual(documentsAfterRemoval.length, 0);
      });

      it("should remove no documents if the provided query matches no documents", async () => {
        const db = await simpleDao.connect();

        const allDocumentsInCollectionPriorToRemoval = await db.collection(collectionName).find({}).toArray();
        assert.strictEqual(allDocumentsInCollectionPriorToRemoval.length, 3);

        const query = {a: 5};
        const result = await simpleDao.for(Model).remove(query);
        deepEqual(result, {n: 0, ok: 1});

        const allDocumentsInCollectionAfterRemoval = await db.collection(collectionName).find({}).toArray();
        assert.strictEqual(allDocumentsInCollectionAfterRemoval.length, 3);
      });

      it("should reject if no query is provided", async () => {
        try {
          await simpleDao.for(Model).remove();
          assert.fail("expected rejection");
        } catch (err) {
          assert.strictEqual(err.message, "query can't be undefined or null");
        }
      });

      it("should reject if the query is invalid", async () => {
        try {
          await simpleDao.for(Model).remove({$badOperator: 1});
          assert.fail("expected rejection");
        } catch (err) {
          assert.strictEqual(err.message, "unknown top level operator: $badOperator");
        }
      });

      it("should reject if an error was encountered when connecting to the database", async () => {
        sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
        try {
          await simpleDao.for(Model).remove({});
          assert.fail("expected rejection");
        } catch (err) {
          assert.strictEqual(err.message, "Some connection error");
        }
      });
    });

    describe(".removeById()", () => {
      describe("when the provided 'id' is an Object ID", () => {
        it("should remove the single document that has the specified id", async () => {
          const result = await simpleDao.for(Model).removeById(modelOne._id);
          deepEqual(result, {n: 1, ok: 1});
          await expectDocumentDoesNotExist(modelOne._id);
        });
      });

      describe("when the provided 'id' is a string", () => {
        it("should remove the single document that has the specified id", async () => {
          const result = await simpleDao.for(Model).removeById(modelOne._id.toString());
          deepEqual(result, {n: 1, ok: 1});
          await expectDocumentDoesNotExist(modelOne._id);
        });

        it("should reject if the provided string is not a valid Object ID", async () => {
          try {
            await simpleDao.for(Model).removeById("1");
            assert.fail("expected rejection");
          } catch (err) {
            assert.strictEqual(err.message, "Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");
          }
        });
      });

      it("should do nothing if there is no document with the specified id", async () => {
        const result = await simpleDao.for(Model).removeById(new ObjectID());
        deepEqual(result, {n: 0, ok: 1});
      });
    });

    describe(".distinct()", () => {
      it("should return an empty array when no field is provided", async () => {
        const results = await simpleDao.for(Model).distinct();
        deepEqual(results, []);
      });

      it("should return all distinct values for the provided field when no query is specified", async () => {
        const results = await simpleDao.for(Model).distinct("a");
        assert.ok(Array.isArray(results));
        assert.ok(results.includes(1));
        assert.ok(results.includes(2));
      });

      it("should return the distinct values for the provided field amongst all documents that match the provided query", async () => {
        const modelFour = Model.factory({a: 3});
        await simpleDao.save(modelFour);
        const results = await simpleDao.for(Model).distinct("a", {a: {$gt: 1}});
        assert.ok(Array.isArray(results));
        assert.ok(results.includes(2));
        assert.ok(results.includes(3));
      });

      it("should reject if the query is invalid", async () => {
        try {
          await simpleDao.for(Model).distinct("a", {$badOperator: 1});
          assert.fail("expected rejection");
        } catch (err) {
          assert.strictEqual(err.message, "unknown top level operator: $badOperator");
        }
      });

      it("should reject if an error was encountered when connecting to the database", async () => {
        sandbox.stub(simpleDao, "connect").rejects(new Error("Some connection error"));
        try {
          await simpleDao.for(Model).distinct("a");
          assert.fail("expected rejection");
        } catch (e) {
          assert.strictEqual(e.message, "Some connection error");
        }
      });
    });
  });
});
