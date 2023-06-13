const { after } = require("mocha");

// eslint-disable-next-line max-statements
describe("SimpleDaoArchive", () => {
    const chai = require("chai");
    const expect = chai.expect;
    const sinon = require("sinon");
    const sandbox = sinon.createSandbox();
    const SimpleDao = require("../").SimpleDao;
    const SimpleDaoArchive = require("../").SimpleDaoArchive;
    const {
        getConnectionString
    } = require("../src/simple-dao");

    let config = null;
    let simpleDao = null;
    let simpleDaoArchive = null;
    let wrapperDaoArchive = null;

    class Model1 {
        static collectionName() {
            return "model_1";
        };

        static factory(literal) {
            return Object.assign(new Model1(), literal);
        }
    };

    class Model2 {
        static collectionName() {
            return "model_2";
        };

        static factory(literal) {
            return Object.assign(new Model2(), literal);
        }
    };

    async function existCollection(db, collection) {
        let collections = await db.listCollections().toArray();
        collections = collections.map(col => col.name);
        return collections.includes(collection);
    };
    
    async function expectDocumentDoesNotExist(db, id, _collectionName = collectionName) {
        const document = await db.collection(_collectionName).findOne({_id: id});
        expect(document).to.not.exist;
    };

    async function expectDocumentExists(db, id, _collectionName = collectionName) {
        const document = await db.collection(_collectionName).findOne({_id: id});
        expect(document).to.exist;
    }

    before(() => {
        config = {
            mainDao: {
                db: {
                    options: {
                        database: "simple_dao_test",
                        username: "",
                        password: ""
                    },
                    uris: ["127.0.0.1:27017"]
                }
            },
            sndDao: {
                db: {
                    options: {
                        database: "simple_dao_archive_test",
                        username: "",
                        password: ""
                    },
                    uris: ["127.0.0.1:27017"]
                }
            }
        };
        mainModel = Model1.factory({_id: SimpleDao.objectId(), name: "mainModel"});
        sndModel = Model2.factory({_id: SimpleDao.objectId(), name: "sndModel"});
        simpleDao = new SimpleDao(config.mainDao);
        simpleDaoArchive = new SimpleDao(config.sndDao);
        wrapperDaoArchive = null;
    });

    after( async () => {
        sandbox.restore();
        const db1 = await simpleDao.connect();
        const db2 = await simpleDaoArchive.connect();
        try {
            if (await existCollection(db1, Model1.collectionName())) {
                await db1.dropCollection(Model1.collectionName());
            }
            if (await existCollection(db2, Model2.collectionName())) {
                await db2.dropCollection(Model2.collectionName());
            }
            return
        } catch (err) {
            console.log('ERR ', err);
        }
    });

    describe("getConnectionString()", () => {
        it("Should return valid connection strings for each dao db server", () => {
            const mainConnectionString = getConnectionString(config.mainDao.db);
            const sndConnectionString = getConnectionString(config.sndDao.db);
            expect(mainConnectionString).to.eql("mongodb://127.0.0.1:27017/simple_dao_test");
            expect(sndConnectionString).to.eql("mongodb://127.0.0.1:27017/simple_dao_archive_test");
            
        });
    });

    describe("Dao connections", () => {
        it("Should return that the mainModel document exists in mainDao's db from the instance of simpleDao", async () => {
            await Promise.all([
                simpleDao.save(mainModel),
                simpleDaoArchive.save(sndModel)
            ]);
            const db = await simpleDao.connect()
            const collection = Model1.collectionName();
            const id = mainModel._id;
            await expectDocumentExists(db, id, collection);
        });

        it("Should return that the sndModel document does not exist in mainDao's db from the instance of simpleDao", async () => {
            const db = await simpleDao.connect();
            const collection = Model2.collectionName();
            const id = sndModel._id;
            await expectDocumentDoesNotExist(db, id, collection);
        })

        it("Should return that the sndModel document exists in sndModel's db from the instance of simpleDaoArchive", async () => {
            const db = await simpleDaoArchive.connect();
            const collection = Model2.collectionName();
            const id = sndModel._id;
            await expectDocumentExists(db, id, collection);
        });

        it("Should return that the mainModel document does not exist in sndModel's db from the instance of simpleDaoArchive", async () => {
            const db = await simpleDaoArchive.connect();
            const collection = Model1.collectionName();
            const id = mainModel._id;
            await expectDocumentDoesNotExist(db, id, collection);
        })
    });

    describe("SimpleDaoArchive Wrapper", () => {
        before(() => {
            wrapperDaoArchive = new SimpleDaoArchive(simpleDao, simpleDaoArchive); 
        });

        describe("findById()", () => {
            it("Should return the document 'mainModel' from mainDao database", async () => {    
                const document = await wrapperDaoArchive.findById(Model1, mainModel._id);
                
                expect(document).to.exist;
                expect(document).to.be.an.instanceOf(Model1);
                expect(document).to.be.eql(mainModel);
            });
    
            it("Should not return the document 'mainModel' from sndDao database", async () => {
                const document = await wrapperDaoArchive.findById(Model2, mainModel._id);

                expect(document).to.not.exist;
            });
    
            it("Should return the document 'sndModel' from sndDao database", async () => {               
                const document2 = await wrapperDaoArchive.findById(Model2, sndModel._id);
                
                expect(document2).to.exist;
                expect(document2).to.be.an.instanceOf(Model2);
                expect(document2).to.be.eql(sndModel);;
            });

            it("Should not return the document 'sndModel' from mainDao database", async () => {
                const document = await wrapperDaoArchive.findById(Model1, sndModel._id);

                expect(document).to.not.exist;
            });
        });

        describe("find()", () => {
            it("Should return a list of elements its name is 'mainModel' from the model_1 collection of the mainDao", async () => {
                const query =  {
                    name: "mainModel"
                };
                const results = await wrapperDaoArchive.find(Model1, query);

                expect(results).to.be.lengthOf(1);
                expect(results[0]).to.be.an.instanceOf(Model1);
                expect(results).to.deep.eql([mainModel])
            });

            it("Should not return elements from the model_1 collection of the mainDao", async () => {
                const query = {
                    name: "notExistModel"
                };
                const results = await wrapperDaoArchive.find(Model1, query);

                expect(results).to.be.lengthOf(0);
            });

            it("Should returnt a list of elements its name is 'sndModel' from the model_2 collection of the sndDao", async () => {
                const query = {
                    name: "sndModel"
                };
                const results = await wrapperDaoArchive.find(Model2, query);

                expect(results).to.be.lengthOf(1);
                expect(results[0]).to.be.an.instanceOf(Model2);
                expect(results).to.deep.eql([sndModel]);
            });

            it("Should not return elements from the  model_2 collection of the sndDao", async () => {
                const query =  {
                    name: "notExistModel"
                };
                const results = await wrapperDaoArchive.find(Model2, query);

                expect(results).to.be.lengthOf(0);
            });
        });
    });
});