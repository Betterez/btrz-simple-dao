"use strict";
let ObjectID = require("mongodb").ObjectID;

class DataMapResult {
  constructor (dataMapId) {
    if (!dataMapId) {
      throw new Error("DataMapResult needs a dataMapId");
    }
    this._id = new ObjectID();
    this.dataMapId = dataMapId;
    this.status = "pending";
    this.errors = [];
  }
  static factory(literal) {
    let dmr = new DataMapResult(literal.dataMapId);
    dmr._id = literal._id;
    dmr.dataMapId = literal.dataMapId;
    dmr.status = literal.status;
    dmr.errors = literal.errors;
    return dmr;
  }
}

exports.DataMapResult = DataMapResult;
