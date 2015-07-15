"use strict";

let utils = require("./utils");

class InnerCursor {
  constructor (cursor, factory) {
    this.cursor = cursor;
    this.factory = factory;
  }
  toCursor() {
    return this.cursor;
  }

  toArray() {
    return this.cursor.toArray().then(utils.mapFor(this.factory));
  }
}


exports.InnerCursor = InnerCursor;
