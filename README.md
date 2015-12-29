# btrz-simple-dao [![Build Status](https://secure.travis-ci.org/Betterez/btrz-simple-dao.png?branch=master)](https://travis-ci.org/Betterez/btrz-simple-dao) [![NPM version](https://badge-me.herokuapp.com/api/npm/btrz-simple-dao.png)](http://badges.enytc.com/for/npm/btrz-simple-dao)

**Very simple** DAO for MongoDb on top of promised-mongo

## Engines

io.js >= v2.0.1

## Change log

  * 1.3.0 - Adding static and instance methods objectId() and objectId(id) to return an instance of an ObjectID object
          - Improve documentation in the README

  * 1.2.0 - Adding support for static collectioName() to override the name of a collection (don't need to be the name of the class to map)
          - Adding support for aggregate cursors directly under `SimpleDao`

## General usage

The api is very simple and fluent.

    simpleDao
      .for(Account)
      .find({})
      .toArray()
      .then(function (results) {
        // do somethig with the results;  
      })
      .catch(function (err) {
        // we crashed
      });

If you are working in a promise based solution you can just return.

    return simpleDao
      .for(Account)
      .find({})
      .toArray();

Or if you much rather use a stream.

    simpleDao
      .for(Account)
      .find({})
      .toCursor()
      .on("data", function (datum) {
        // do work
      });

## Api

### new SimpleDao(config)

Creates a new instance of a simple dao.
The `config` argument is expected to have the form.

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

### .for(Model)

Returns an instance of a `Operator` that will map results to instances of the `Model`
The `Model` class is expected to have an static `factory` method.
The `Model` class can have an static `collectioName` method that the `Operator` will use to query the collection if the `collectionName` is not found it will use the name of the class (object) in lower case as the name of the collection.

    let operator = simpleDao.for(Account);
    //this will query a collection with the name "account"

If we want to use a different name, we can create a model with the `collectionName` static function

    class User {

      static collectionName() {
        return "people";
      }

      static factory(literal) {
        var user = new User();
        user.name = literal.name;
        //Other mappings transformations go hear.
        return user;
      }
    }

    let operator = simpleDao.for(User);
    //In this case it will query a collection with the name "people";

### .aggregate(collectionName, pipeline)

This method will return a promise.
The promise should resolve to a stream cursor with the result of applying the given `pipeline` unto the collection of the given `collectionName`.

    let pipeline = [
      {$group: {_id: "$accountId", totalPop: {$sum: "$dataMapId"}}}
    ];

    simpleDao
      .aggregate("accounts", pipeline)
      .then(function (cursor) {
        cursor
          .on("data", function (datum) {
            // work with the data
          })
          .on("end", function () {
            //we are done
          })
          .on("error", function (err) {
            //we crashed
          });
        });

The aggregate method will use the following options when calling the database.

    {
      allowDiskUsage: true,
      cursor: {batchSize: 1000}
    }

`allowDiskUsage` will prevent errors due to size limits on the results.

### .save(model)

It will save the model into a collection for that model (see above on the `for` method to understand how the collection name is set).
There is no serialization strategy at the moment so "all" public methods and properties will be saved into the database.

### .objectId()

There are an static and an instance version of the method for convenience.
It takes an optional parameter that should be a valid 24 characters id.

#### Static version

    SimpleDao.objectId() //Returns a new ObjectID;
    SimpleDao.objectId("55b27c2a74757b3c5e121b0e") //Return an ObjectID for that id.

#### Instance version

    let simpleDao = new SimpleDao(config);
    simpleDao.objectId() //Returns a new ObjectID;
    simpleDao.objectId("55b27c2a74757b3c5e121b0e") //Return an ObjectID for that id.

### connectionString

Is a property that will return the connection string the object is using to connect to Mongo.

### new Operator() //Private

The Operator is a private object that is accessed via the `.for` method factory on a SimpleDao instance.

### .find(query, options)

It will perform a `find` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the given `query` and `options`.
The query and options are the same as with the node mongodb driver find method.

    let innerCursor = simpleDao.for(Account).find({}); //Returns an inner cursor with all documents in the account collection.

### .findOne(query)

It will perform a `findOne` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the given `query`.

    simpleDao.for(Account).findOne({name: "new account"}); //Returns a promise that will resolve to the document or null (if it can't find one).

### .findById(id)

It will perform a `findOne` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the query {_id: id}.

    simpleDao.for(Account).findById(SimpleDao.objectId("55b27c2a74757b3c5e121b0e")); //Returns a promise that will resolve to the document or null (if it can't find one).

You can pass anything to the id not just ObjectID, it will depend on what do you use to generate the `_id` in the mongo collections.

### .update(query, update, options)

It will perform an `update` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the given `query`, applying the `update` and `options`.
The query, update and options are the same as with the node mongodb driver update method.

    simpleDao.for(Account).update({name: "new account"}, { $set: {name: "Peter account"}}); //Returns a promise with the result report than the node mongodb driver.

### new innerCursor() //Private

The innerCursor is a private object that is accessed via the `.find` method factory on an instance of the Operator.
It contains only 2 methods

### .toArray()

It will iterate over the results and create instance of the `Model` given to the `.for` method. It will return a promise that will resolve to an array with the results.

### .toCursor()

It will return a streaming cursor with the results.
