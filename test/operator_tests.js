describe("Operator", () => {
  const Operator = require("../src/operator.js").Operator;
  const {expect} = require("chai");

  describe("#cleanOptions", () => {
    it("should return an empty options object", () => {
      expect(Operator.cleanOptions()).to.eql({});
    });

    it("should remove the w property when adding as a string", () => {
      expect(Operator.cleanOptions({"w": 1})).to.eql({});
    });

    it("should remove the w property", () => {
      expect(Operator.cleanOptions({w: 1})).to.eql({});
    });

    it("should not remove the multi property", () => {
      expect(Operator.cleanOptions({w: 1, multi: true})).to.eql({multi: true});
    });
  });
});