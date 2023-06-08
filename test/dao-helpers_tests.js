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
            let model1 = new Model1();
            model1.name = literal.name;
            return model1;
        }
    };

    class Model2 {
        static collectionName() {
            return "model_2";
        };

        static factory(literal) {
            let model2 = new Model2();
            model2.name = literal.name;
            return model2;
        }
    };

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
        mainModel = Model1.factory({name: "mainModel"});
        sndModel = Model2.factory({name: "sndModel"});
        simpleDao = new SimpleDao(config.mainDao);
        simpleDaoArchive = new SimpleDao(config.sndDao);
        wrapperDaoArchive = null;
    });

    after( async () => {
        sandbox.restore();
        const db1 = await simpleDao.connect();
        const db2 = await simpleDaoArchive.connect();
        try {
            if (await existCollection(db1, mainModel.collectionName())) {
                await db1.dropCollection(mainModel.collectionName());
            }
            if (await existCollection(db2, sndModel.collectionName())) {
                await db2.dropCollection(sndModel.collectionName());
            }
        } catch (err) {
            // ignore error
        }
    });

    async function existCollection(db, collection) {
        const collections = await db.listCollections().toArray()
        return collections.includes(collection);
    };
    
    async function expectDocumentDoesNotExist(db, id, _collectionName = collectionName) {
        // const db = await simpleDao.connect();
        const document = await db.collection(_collectionName).findOne({_id: id});
        expect(document).to.not.exist;
    };

    async function expectDocumentExists(db, id, _collectionName = collectionName) {
        const document = await db.collection(_collectionName).findOne({_id: id});
        expect(document).to.exist;
    }

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
                expect(document.name).to.be.equal(mainModel.name);
            });
    
            it("Should not return the document 'mainModel' from sndDao database", async () => {
                const document = await wrapperDaoArchive.findById(Model2, mainModel._id);

                expect(document).to.not.exist;
            });
    
            it("Should return the document 'sndModel' from sndDao database", async () => {               
                const document2 = await wrapperDaoArchive.findById(Model2, sndModel._id);
                
                expect(document2).to.exist;
                expect(document2).to.be.an.instanceOf(Model2);
                expect(document2.name).to.be.equal(sndModel.name);;
            });

            it("Should not return the document 'sndModel' from mainDao database", async () => {
                const document = await wrapperDaoArchive.findById(Model1, sndModel._id);

                expect(document).to.not.exist;
            });
        });
    });
});