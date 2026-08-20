const {describe, it} = require("node:test");
const assert = require("node:assert").strict;
const {
  hasRequired,
  idsFromQuery,
  resolveUserId,
  resolveAccountId,
  normalizeContext,
  scalarAccountId,
  resolveTargets,
  recordUpdates,
  recordDeletes,
  throwIfStrictMissing
} = require("../src/audit");

describe("audit helpers", () => {
  it("idsFromQuery returns scalar _id", () => {
    assert.deepEqual(idsFromQuery({_id: "abc"}), {kind: "ids", ids: ["abc"]});
  });

  it("idsFromQuery returns $in", () => {
    assert.deepEqual(
      idsFromQuery({_id: {$in: ["a", "b"]}}),
      {kind: "ids", ids: ["a", "b"]}
    );
  });

  it("idsFromQuery is unknown without _id", () => {
    assert.deepEqual(idsFromQuery({accountId: "acc"}), {kind: "unknown"});
  });

  it("idsFromQuery treats falsy scalar _id as ids", () => {
    assert.deepEqual(idsFromQuery({_id: 0}), {kind: "ids", ids: [0]});
    assert.deepEqual(idsFromQuery({_id: false}), {kind: "ids", ids: [false]});
  });

  it("resolveUserId prefers explicit over $set.updatedBy", () => {
    assert.equal(
      resolveUserId({update: {$set: {updatedBy: "from-set"}}, explicitUserId: "arg"}),
      "arg"
    );
  });

  it("resolveUserId prefers explicit over model.updatedBy", () => {
    assert.equal(resolveUserId({model: {updatedBy: "u1"}, explicitUserId: "arg"}), "arg");
  });

  it("resolveUserId uses explicit when updatedBy missing", () => {
    assert.equal(resolveUserId({update: {$set: {a: 1}}, explicitUserId: "arg"}), "arg");
  });

  it("resolveUserId uses model.updatedBy", () => {
    assert.equal(resolveUserId({model: {updatedBy: "u1"}}), "u1");
  });

  it("normalizeContext returns a plain object as-is", () => {
    const context = {accountId: "acc1", userId: "u1"};
    assert.deepEqual(normalizeContext(context), context);
  });

  it("normalizeContext treats a string as missing context", () => {
    assert.deepEqual(normalizeContext("u1"), {});
  });

  it("normalizeContext treats undefined and null as missing context", () => {
    assert.deepEqual(normalizeContext(undefined), {});
    assert.deepEqual(normalizeContext(null), {});
  });

  it("resolveAccountId prefers explicit over model, query, and $set", () => {
    assert.equal(
      resolveAccountId({
        model: {accountId: "from-model"},
        query: {accountId: "from-query"},
        update: {$set: {accountId: "from-set"}},
        explicitAccountId: "from-context"
      }),
      "from-context"
    );
  });

  it("resolveAccountId uses model then query then $set", () => {
    assert.equal(resolveAccountId({model: {accountId: "from-model"}}), "from-model");
    assert.equal(
      resolveAccountId({query: {accountId: "from-query"}, update: {$set: {accountId: "from-set"}}}),
      "from-query"
    );
    assert.equal(resolveAccountId({update: {$set: {accountId: "from-set"}}}), "from-set");
  });

  it("scalarAccountId ignores operator objects", () => {
    assert.equal(scalarAccountId({accountId: {$in: ["x"]}}), undefined);
    assert.equal(scalarAccountId({accountId: "acc1"}), "acc1");
  });

  it("hasRequired rejects empty string", () => {
    assert.equal(hasRequired(""), false);
    assert.equal(hasRequired("u"), true);
  });

  it("resolveTargets skips find when _id is known", async () => {
    let findCalled = false;
    const collection = {
      find() {
        findCalled = true;
        return {toArray: async () => []};
      }
    };
    const targets = await resolveTargets(collection, {_id: "id1", accountId: "acc1"});
    assert.equal(findCalled, false);
    assert.deepEqual(targets, [{_id: "id1", accountId: "acc1"}]);
  });

  it("resolveTargets skips find when _id is known even without accountId", async () => {
    let findCalled = false;
    const collection = {
      find() {
        findCalled = true;
        return {toArray: async () => [{_id: "id1", accountId: "from-doc"}]};
      }
    };
    const targets = await resolveTargets(collection, {_id: "id1"});
    assert.equal(findCalled, false);
    assert.deepEqual(targets, [{_id: "id1", accountId: undefined}]);
  });

  it("resolveTargets finds _id and uses accountId from the query, not the document", async () => {
    let findOptions = null;
    const collection = {
      find(query, options) {
        findOptions = options;
        return {toArray: async () => [{_id: "id1", accountId: "from-doc"}]};
      }
    };
    const targets = await resolveTargets(collection, {name: "x", accountId: "acc1"});
    assert.deepEqual(findOptions, {projection: {_id: 1}});
    assert.deepEqual(targets, [{_id: "id1", accountId: "acc1"}]);
  });

  it("throwIfStrictMissing throws when strict and userId is missing", () => {
    assert.throws(
      () => throwIfStrictMissing({strict: true}, undefined, [{_id: "1", accountId: "a"}]),
      /audit identity missing: userId/
    );
  });

  it("throwIfStrictMissing throws when strict and target accountId is missing", () => {
    assert.throws(
      () => throwIfStrictMissing({strict: true}, "u1", [{_id: "id1"}]),
      /audit identity missing/
    );
  });

  it("throwIfStrictMissing does not throw on empty targets", () => {
    throwIfStrictMissing({strict: true}, "u1", []);
  });

  it("recordUpdates skips when userId is missing", async () => {
    const calls = [];
    await recordUpdates({recordMongo(event) { calls.push(event); }}, {
      targets: [{_id: "1", accountId: "a"}],
      collectionName: "c",
      userId: undefined,
      query: {_id: "1"},
      payload: {$set: {a: 1}}
    });
    assert.equal(calls.length, 0);
  });

  it("recordUpdates awaits a targets promise and records one event when multi is false", async () => {
    const calls = [];
    await recordUpdates({recordMongo(event) { calls.push(event); }}, {
      targets: Promise.resolve([
        {_id: "1", accountId: "a"},
        {_id: "2", accountId: "a"}
      ]),
      collectionName: "c",
      userId: "u1",
      query: {name: "x"},
      payload: {$set: {a: 1}},
      multi: false
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].objectId, "1");
  });

  it("recordDeletes omits payload", async () => {
    const calls = [];
    await recordDeletes({recordMongo(event) { calls.push(event); }}, {
      targets: [{_id: "1", accountId: "a"}],
      collectionName: "c",
      userId: "u1",
      query: {_id: "1"}
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].operation, "delete");
    assert.equal("payload" in calls[0], false);
  });

  it("recordUpdates forwards folder without replacing collectionName", async () => {
    const calls = [];
    await recordUpdates({recordMongo(event) { calls.push(event); }}, {
      targets: [{_id: "1", accountId: "a"}],
      collectionName: "accounts",
      userId: "u1",
      query: {_id: "1"},
      payload: {$set: {a: 1}},
      folder: "email-settings"
    });
    assert.equal(calls[0].collectionName, "accounts");
    assert.equal(calls[0].folder, "email-settings");
  });

  it("recordUpdates omits folder when it is null or empty", async () => {
    const calls = [];
    await recordUpdates({recordMongo(event) { calls.push(event); }}, {
      targets: [{_id: "1", accountId: "a"}],
      collectionName: "accounts",
      userId: "u1",
      query: {_id: "1"},
      payload: {$set: {a: 1}},
      folder: null
    });
    await recordUpdates({recordMongo(event) { calls.push(event); }}, {
      targets: [{_id: "1", accountId: "a"}],
      collectionName: "accounts",
      userId: "u1",
      query: {_id: "1"},
      payload: {$set: {a: 1}},
      folder: ""
    });
    assert.equal("folder" in calls[0], false);
    assert.equal("folder" in calls[1], false);
    assert.equal(calls[0].collectionName, "accounts");
  });
});
