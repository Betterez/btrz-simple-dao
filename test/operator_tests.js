const assert = require("node:assert").strict;
const { describe, it } = require("node:test");

describe("Operator", () => {
  const Operator = require("../src/operator.js").Operator;

  describe("#cleanOptions", () => {
    it("should return an empty options object", () => {
      assert.deepStrictEqual(Operator.cleanOptions(), {});
    });

    it("should remove the w property when adding as a string", () => {
      assert.deepStrictEqual(Operator.cleanOptions({"w": 1}), {});
    });

    it("should remove the w property", () => {
      assert.deepStrictEqual(Operator.cleanOptions({w: 1}), {});
    });

    it("should not remove the multi property", () => {
      assert.deepStrictEqual(Operator.cleanOptions({w: 1, multi: true}), {multi: true});
    });
  });
});
