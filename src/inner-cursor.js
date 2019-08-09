
class InnerCursor {
  constructor(cursorPromise, factory) {
    this.cursorPromise = cursorPromise;
    this.factory = factory;
  }

  toCursor() {
    return this.cursorPromise;
  }

  async toArray() {
    const cursor = await this.cursorPromise;
    const results = await cursor.toArray();

    return results.map(this.factory);
  }
}


exports.InnerCursor = InnerCursor;
