

const utils = require("./utils");

class InnerCursor {
  constructor(cursor, factory) {
    this.cursor = cursor;
    this.factory = factory;
  }

  toCursor() {
    return this.cursor;
  }

  toArray() {
    return this.cursor
      .then((c) => {
        return c.toArray().then(utils.mapFor(this.factory));
      })
      .catch((err) => {
        throw err;
      });
  }
}


exports.InnerCursor = InnerCursor;
