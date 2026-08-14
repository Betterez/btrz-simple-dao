const {describe, it} = require("node:test");
const assert = require("node:assert").strict;
const {
  hasRequired,
  idsFromQuery,
  resolveUserId,
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

  it("resolveUserId prefers $set.updatedBy over explicit", () => {
    assert.equal(
      resolveUserId({update: {$set: {updatedBy: "from-set"}}, explicitUserId: "arg"}),
      "from-set"
    );
  });

  it("resolveUserId uses explicit when updatedBy missing", () => {
    assert.equal(resolveUserId({update: {$set: {a: 1}}, explicitUserId: "arg"}), "arg");
  });

  it("resolveUserId uses model.updatedBy", () => {
    assert.equal(resolveUserId({model: {updatedBy: "u1"}}), "u1");
  });

  it("scalarAccountId ignores operator objects", () => {
    assert.equal(scalarAccountId({accountId: {$in: ["x"]}}), undefined);
    assert.equal(scalarAccountId({accountId: "acc1"}), "acc1");
  });

  it("hasRequired rejects empty string", () => {
    assert.equal(hasRequired(""), false);
    assert.equal(hasRequired("u"), true);
  });

  it("resolveTargets skips find when _id and accountId are known", async () => {
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

  it("resolveTargets finds when accountId is missing", async () => {
    let findQuery = null;
    const collection = {
      find(query) {
        findQuery = query;
        return {toArray: async () => [{_id: "id1", accountId: "from-doc"}]};
      }
    };
    const query = {_id: "id1"};
    const targets = await resolveTargets(collection, query);
    assert.deepEqual(findQuery, query);
    assert.deepEqual(targets, [{_id: "id1", accountId: "from-doc"}]);
  });

  it("throwIfStrictMissing throws when strict and userId is missing", () => {
    assert.throws(
      () => throwIfStrictMissing({strict: true}, undefined, [{_id: "1", accountId: "a"}]),
      /audit identity missing: userId/
    );
  });

  it("throwIfStrictMissing does not throw on empty targets", () => {
    throwIfStrictMissing({strict: true}, "u1", []);
  });

  it("recordUpdates skips when userId is missing", () => {
    const calls = [];
    recordUpdates({recordMongo(event) { calls.push(event); }}, {
      targets: [{_id: "1", accountId: "a"}],
      collectionName: "c",
      userId: undefined,
      query: {_id: "1"},
      payload: {$set: {a: 1}}
    });
    assert.equal(calls.length, 0);
  });

  it("recordDeletes omits payload", () => {
    const calls = [];
    recordDeletes({recordMongo(event) { calls.push(event); }}, {
      targets: [{_id: "1", accountId: "a"}],
      collectionName: "c",
      userId: "u1",
      query: {_id: "1"}
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].operation, "delete");
    assert.equal("payload" in calls[0], false);
  });
});
