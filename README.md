# btrz-simple-dao [![npm version](https://badge.fury.io/js/btrz-simple-dao.svg)](https://badge.fury.io/js/btrz-simple-dao)

**Very simple** DAO for MongoDb on top of promised-mongo

[Why are we still using mongoDB 2.1.8?](https://www.google.ca/search?q=node+mongodb+MongoError%3A+no+mongos+proxy+available&oq=node+mongodb+MongoError%3A+no+mongos+proxy+available&aqs=chrome..69i57.6537j0j4&sourceid=chrome&ie=UTF-8)

## Engines

node >= v6.11.1

## Change log
  * 2.6.3 - Aggregate operations now pass the `allowDiskUse` option instead of `allowDiskUsage` (which had no effect)

  * 2.6.2 - Removed now unnecessary forcing updatedAt.value datetime to be UTC.

  * 2.6.1 - Forced updatedAt.value datetime to be UTC.

  * 2.6.0 - Updated save method to update the updatedAt.value datetime of the saved model if field exists.

  * 2.4.6 - Refactor removeById on Operator, document remove and removeById.

  * 2.4.5 - Added new method remove on Operator.

  * 2.4.4 - Upgrade node to v6.11.1 and mock-simple-dao added.

  * 2.2.1 - Updated docs.
  
  * 2.2.0 - Added new method findAggregate on Operator to be used similar to existing find method.
  
  * 2.1.1 - Fixing a memory leak since we were re-adding the listener to the on("error") of the db for each operation. If you are using 2.0.0 or 2.1.0 update now.
  
  * 2.1.0 - Added .count() method to return a count.
          - Added .dropCollection() method

  * 2.0.0 - Removed dependency on promised-mongo,
          - Modified the API: toCursor() now also returns a promise.
          - Catch disconnect events and will reconnect automatically in the net request that can find an available connection.
          - Added a logger as a second constructor parameter (it should implement both an `info` and an `error` methods)

  * 1.6.2 - Handle disconnect gracefully and reconnects if server comes back on a timely manner.

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

Or if you much rather use a stream (changed API on 2.0 toCursor returns a promise as well)

    simpleDao
      .for(Account)
      .find({})
      .toCursor()
      .then((cursor) => {
        cursor.on("data", function (datum) {
          // do work
        })
        .on("end", function () {
          //we are done
        })
        .on("error", function (err) {
          //we crashed
        });
      });

## Api

### new SimpleDao(config, logger)

Changed in v2.0 we added the logger non mandatory parameter.
Logger is expected to implement the `.info` and `.error` methods.

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
      allowDiskUse: true,
      cursor: {batchSize: 1000}
    }

`allowDiskUse` will prevent errors due to size limits on the results.

### .save(model)

It will save the model into a collection for that model (see above on the `for` method to understand how the collection name is set).
There is no serialization strategy at the moment so "all" public methods and properties will be saved into the database.

### .dropCollection(name)

It will drop the collection from the database.

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

### .count(query)

It will perform a `.count` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the given `query`.
If the query is not provided it will default to a count on the complete collection.

    simpleDao.for(Account).count({name: "new account"}); //Returns a promise that will resolve to the count of documents matching the query.

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

### .findAggregate(pipeline)

An alternative to the `aggregate` method on SimpleDao, but is meant to be used with `for` method (see above). Same options of `aggregate` applies.

    let innerCursor = simpleDao.for(Account).findAggregate([{"$match": {...}}, {"$unwind": {...}}, ...]); //Returns an inner cursor with all the aggregates for the account collection.

### .removeById(id)

It will perform a `remove` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the query {_id: id}.

    simpleDao.for(Account).removeById(SimpleDao.objectId("55b27c2a74757b3c5e121b0e")); //Returns a promise that will resolve to the remove result: {ok: 1, n: 1} where n is the count of deleted documents.

You can pass anything to the id not just ObjectID, it will depend on what do you use to generate the `_id` in the mongo collections.

### .remove(query)

It will perform a `remove` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the given query.

    simpleDao.for(Account).remove({name: "super"}); //Returns a promise that will resolve to the remove result: {ok: 1, n: 5} where n is the count of deleted documents.

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

## Mock Simple Dao
It is a mock for testing simple-dao that supports all the simple-dao operations.
Currently, for find and findAggregate `toCursor()` is not available.
### how to use
You can pass a source object specifying the expected result for each operation.

    const mockSimpleDao = require("btrz-simple-dao").mockSimpleDao;`

    source = {
      find: [data],
      update: {}
    };
    mockDao = mockSimpleDao(source);

    mockDao.find().toArray();
    //  [data]