const {describe, it} = require("node:test");
const assert = require("node:assert").strict;
const {
  hasRequired,
  idsFromQuery,
  resolveUserId,
  scalarAccountId
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
});
