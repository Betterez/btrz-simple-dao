# btrz-simple-dao

A **very simple** DAO for MongoDb.
Compatible with NodeJS versions 6.11.1 and higher.


## Change log
See releases

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

### new SimpleDao(config, logger, auditor?)

Changed in v2.0 we added the logger non mandatory parameter.
Logger is expected to implement the `.info` and `.error` methods.

Changed in v4.7.0 we added the optional `auditor` parameter. When omitted, `null`, or `undefined`, writes behave as before (no extra `find`). When present, each successful write records one event per written document via `auditor.recordMongo`. See **Audit: panopticon, context, and when writes throw** below.

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

### Audit: panopticon, context, and when writes throw

Writes (`save`, `update`, `remove`, `removeById`) can record one event per written document. Reads are never audited.

This library does **not** depend on `btrz-panopticon`. Pass an auditor as the third constructor argument. The auditor is duck-typed:

    auditor = {
      strict: false, // when true, missing identity throws after the write; when false, audit is fire-and-forget
      recordMongo({accountId, collectionName, objectId, userId, operation, query, payload, folder}) {}
    };

#### Adding panopticon

Install `btrz-panopticon` in the **calling** service (API), not in this package. Create an auditor and pass it into `SimpleDao`:

    const {createAuditor} = require("btrz-panopticon");
    const {SimpleDao} = require("btrz-simple-dao");

    const auditor = createAuditor({
      ...config.auditLogger, // bucket, region, credentials, …
      strict: process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
    }, logger);

    const dao = new SimpleDao(config, logger, auditor);

Omit the auditor (or pass `null` / `undefined`) and writes behave as before: no extra `find`, no events.

Use `strict: true` in development and tests so missing identity fails loudly. In production keep `strict: false` so a missing audit field never fails the Mongo write. Incomplete panopticon config (missing bucket/region/credentials) returns a no-op auditor with `strict: false`.

#### How context is used

Optional `context` is `{accountId, userId, folder}`. It is ignored unless an auditor was passed to the constructor. Both identity fields are optional. A string last argument is **not** treated as `userId`.

    dao.save(model, {accountId, userId, folder: "email-settings"});
    dao.for(Model).update(query, update, options, {accountId, userId, folder: "email-settings"});
    dao.for(Model).remove(query, {accountId, userId});
    dao.for(Model).removeById(id, {accountId, userId});

`folder` is forwarded to `recordMongo` only when it is a non-empty string. `null`, `""`, or omitted means panopticon uses `collectionName` for the S3 path. `collectionName` on the event is always the Mongo collection.

On `update`, context is the **fourth** argument so `{multi: true}` is not treated as context. Callers who skip `options` pass `undefined`:

    dao.for(Account).update(query, {$set: {updatedBy}}, undefined, {accountId, userId});

Identity is resolved in this order (first present wins):

**userId**

1. `context.userId`
2. `model.updatedBy` (`save`)
3. `update.$set.updatedBy` (`update`)
4. missing (`remove` / `removeById` have no `updatedBy` fallback)

**accountId**

1. `context.accountId`
2. `model.accountId` (`save`)
3. scalar `query.accountId`
4. `update.$set.accountId`
5. missing

`accountId` is never read from documents returned by a pre-write find. A query / `$set` value is scalar only if it is not `null` and not a plain object (`$in` / `$eq` objects are ignored).

**objectId** comes from `model._id` after save, from a scalar or `$in` query `_id`, or from a `{_id: 1}` find that runs in parallel with `update` / `remove` when the query does not already have `_id`.

#### When context is necessary

Context is only needed when an auditor is present **and** identity cannot be taken from the model or the write itself.

Pass `context` when:

- The document has no `accountId` field (for example `Account`, where `_id` *is* the account). Do not add `accountId` onto that document just for audit.
- `updatedBy` is not on the model (`save`) and not in `$set` (`update`).
- You `remove` / `removeById`. Deletes have no `$set.updatedBy`; `removeById` queries `{_id}` only, so both `accountId` and `userId` must come from context.

You can omit context when the model already has `accountId` and `updatedBy` (`save`), or the query / `$set` already has a scalar `accountId` and `$set.updatedBy` (`update`).

#### When audit throws

Audit never runs if the Mongo write threw.

When `auditor.strict` is **false** (production): missing identity skips `recordMongo`; audit errors are logged; `update` / `remove` return without waiting for audit. The write result is unchanged.

When `auditor.strict` is **true** (dev/test): the write still happens first, then audit is awaited and **throws** `Error` with message `[btrz-simple-dao] audit identity missing: …` if:

- **save:** `_id`, `userId`, or `accountId` is still missing after the write.
- **update / remove:** `userId` is missing, or any matched target is missing `accountId` or `_id`.

An empty match is not an error (no events, no throw). If `recordMongo` itself throws (panopticon `strict`), that error also propagates after the write.

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

### .save(model, context?)

It will save the model into a collection for that model (see above on the `for` method to understand how the collection name is set).
There is no serialization strategy at the moment so "all" public methods and properties will be saved into the database.

Optional `context` is `{accountId, userId}` (see **Audit** above). After a successful save the auditor records `operation: "insert"` with the saved model as `payload`.

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

### .removeById(id, context?)

It will perform a `remove` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the query {_id: id}.

    simpleDao.for(Account).removeById(SimpleDao.objectId("55b27c2a74757b3c5e121b0e")); //Returns a promise that will resolve to the remove result: {ok: 1, n: 1} where n is the count of deleted documents.

You can pass anything to the id not just ObjectID, it will depend on what do you use to generate the `_id` in the mongo collections.

Optional `context` is `{accountId, userId}` (see **Audit** above). `removeById` can record when `context.accountId` is provided (the query remains `{_id}`).

### .remove(query, context?)

It will perform a `remove` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the given query.

    simpleDao.for(Account).remove({name: "super"}); //Returns a promise that will resolve to the remove result: {ok: 1, n: 5} where n is the count of deleted documents.

Optional `context` is `{accountId, userId}` (see **Audit** above). Each deleted document records `operation: "delete"` (no `payload`).

### .update(query, update, options, context?)

It will perform an `update` on the collection that the operator have been created for (see above on the `for` method to understand how the collection name is set) with the given `query`, applying the `update` and `options`.
The query, update and options are the same as with the node mongodb driver update method.

    simpleDao.for(Account).update({name: "new account"}, { $set: {name: "Peter account"}}); //Returns a promise with the result report than the node mongodb driver.

Optional `context` is `{accountId, userId}` and is the **fourth** argument (see **Audit** above). Callers who skip `options` pass `undefined`:

    simpleDao.for(Account).update(query, {$set: {updatedBy}}, undefined, {accountId, userId});

Each written document records `operation: "update"` with the filter as `query` and the update doc as `payload`. Without `{multi: true}` only the first match is written and recorded.

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
