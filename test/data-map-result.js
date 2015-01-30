"use strict";
let uuid = require("uuid");

function DataMapResult(dataMapId) {
  if (!dataMapId) {
    throw new Error("DataMapResult needs a dataMapId");
  }
  this._id = uuid.v1();
  this.dataMapId = dataMapId;
  this.status = "pending";
  this.errors = [];
}

DataMapResult.factory = function (literal) {
  let dmr = new DataMapResult(literal.dataMapId);
  dmr._id = literal._id;
  dmr.dataMapId = literal.dataMapId;
  dmr.status = literal.status;
  dmr.errors = literal.errors;
  return dmr;
};

exports.DataMapResult = DataMapResult;