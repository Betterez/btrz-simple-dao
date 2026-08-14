# SimpleDao Mongo Audit Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optional `auditor` on `SimpleDao` records one `recordMongo` per written document, with find-before-write when `_id` is not already known, without adding a `btrz-panopticon` dependency.

**Architecture:** Pure helpers in `src/audit.js`. `SimpleDao` / `Operator` call them around existing Mongo writes. No auditor → skip helpers entirely (no extra find).

**Tech Stack:** Node.js CommonJS, `node:test`, existing Mongo integration tests in `test/simple-dao_tests.js`. Mock auditor: `{strict, recordMongo}`.

## Global Constraints

- No `btrz-panopticon` package dependency.
- Existing `new SimpleDao(config)` tests must stay green.
- Extra `find` only when `this.auditor` is truthy.
- ClickUp: CU-86bbe2byz. Commit tag `CU-86bbe2byz` only if the user asks.
- Spec: `docs/superpowers/specs/2026-08-14-mongo-audit-hooks-design.md`.
- TDD-first.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/audit.js` | Identity resolution, query id extraction, find targets, `recordMongo` fan-out |
| `src/simple-dao.js` | `auditor` ctor arg; `save(model, userId?)` |
| `src/operator.js` | `update` / `remove` / `removeById` optional `userId` |
| `test/audit_tests.js` | Unit tests for helpers |
| `test/simple-dao_tests.js` | Mongo + mock auditor |
| `package.json` | Include `test/audit_tests.js`; version `4.7.0` |
| `README.md` | Constructor and optional `userId` |

---

### Task 1: Pure helpers + unit tests

**Files:**
- Create: `src/audit.js`, `test/audit_tests.js`
- Modify: `package.json` (`test` script must include `test/audit_tests.js`)

**Interfaces:**
- Produces:
  - `hasRequired(value) → boolean`
  - `scalarId(value) → value | null` (string, ObjectID, or `{_bsontype:"ObjectId"}`)
  - `idsFromQuery(query) → {kind: "ids", ids: Array} | {kind: "unknown"}`
  - `resolveUserId({model, update, explicitUserId}) → value | undefined`
  - `scalarAccountId(source) → value | undefined`
  - `missingIdentityError(fields) → Error` message `[btrz-simple-dao] audit identity missing: …`

- [ ] **Step 1: Write `test/audit_tests.js`**

```js
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
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `node --test --test-force-exit test/audit_tests.js`

- [ ] **Step 3: Implement `src/audit.js` helpers (identity + idsFromQuery only; find/record in later tasks)**

```js
"use strict";

function hasRequired(value) {
  return value !== undefined && value !== null && value !== "";
}

function scalarId(value) {
  if (!hasRequired(value)) {
    return null;
  }
  if (typeof value === "object" && !value._bsontype && value.constructor && value.constructor.name !== "ObjectID") {
    return null;
  }
  if (typeof value === "object" && value.$in) {
    return null;
  }
  return value;
}

function idsFromQuery(query) {
  if (!query || query._id == null) {
    return {kind: "unknown"};
  }
  const id = scalarId(query._id);
  if (id) {
    return {kind: "ids", ids: [id]};
  }
  if (query._id.$in && Array.isArray(query._id.$in)) {
    return {kind: "ids", ids: query._id.$in};
  }
  return {kind: "unknown"};
}

function resolveUserId({model, update, explicitUserId} = {}) {
  if (model && hasRequired(model.updatedBy)) {
    return model.updatedBy;
  }
  if (update && update.$set && hasRequired(update.$set.updatedBy)) {
    return update.$set.updatedBy;
  }
  if (hasRequired(explicitUserId)) {
    return explicitUserId;
  }
  return undefined;
}

function scalarAccountId(source) {
  if (!source) {
    return undefined;
  }
  const value = source.accountId;
  if (!hasRequired(value) || (typeof value === "object" && value !== null && !(value._bsontype))) {
    return undefined;
  }
  return value;
}

function missingIdentityError(fields) {
  return new Error(`[btrz-simple-dao] audit identity missing: ${fields.join(", ")}`);
}

module.exports = {
  hasRequired,
  scalarId,
  idsFromQuery,
  resolveUserId,
  scalarAccountId,
  missingIdentityError
};
```

Fix `scalarId` so BSON ObjectID instances count as scalar ids (they are objects). Treat as scalar if `typeof value !== "object"` OR `_bsontype === "ObjectId"` OR `constructor.name === "ObjectID"`. Treat as non-scalar if `value.$in` or other operators.

- [ ] **Step 4: Add `test/audit_tests.js` to the `test` script in `package.json`**

- [ ] **Step 5: Run `npm test` — helpers pass; existing suite still passes**

---

### Task 2: `save(model, userId?)` with mock auditor

**Files:**
- Modify: `src/simple-dao.js`, `src/audit.js`, `test/simple-dao_tests.js`

**Interfaces:**
- Consumes: helpers from Task 1
- Produces: `new SimpleDao(options, logger, auditor)`; after successful save, `recordMongo` once

- [ ] **Step 1: Write failing tests in `test/simple-dao_tests.js`**

Inside `describe(".save()")`, after existing cases, add a nested `describe("with auditor")`:

```js
function mockAuditor({strict} = {}) {
  const calls = [];
  return {
    strict: Boolean(strict),
    calls,
    recordMongo(event) {
      calls.push(event);
    }
  };
}

it("does not call recordMongo when no auditor is passed", async () => {
  await simpleDao.save(Model.factory({a: 1, accountId: "acc1", updatedBy: "u1"}));
  // no throw; default simpleDao has no auditor
});

it("records insert after save using model._id, updatedBy, accountId", async () => {
  const auditor = mockAuditor();
  const dao = new SimpleDao(config, null, auditor);
  const saved = await dao.save(Model.factory({
    a: 1,
    accountId: "acc1",
    updatedBy: "u1"
  }));
  assert.equal(auditor.calls.length, 1);
  assert.equal(auditor.calls[0].operation, "insert");
  assert.equal(String(auditor.calls[0].objectId), String(saved._id));
  assert.equal(auditor.calls[0].userId, "u1");
  assert.equal(auditor.calls[0].accountId, "acc1");
  assert.equal(auditor.calls[0].collectionName, collectionName);
  assert.equal(auditor.calls[0].payload.a, 1);
});

it("uses explicit userId when model.updatedBy is missing", async () => {
  const auditor = mockAuditor();
  const dao = new SimpleDao(config, null, auditor);
  await dao.save(Model.factory({a: 1, accountId: "acc1"}), "explicit-user");
  assert.equal(auditor.calls[0].userId, "explicit-user");
});

it("skips recordMongo when identity missing and not strict", async () => {
  const auditor = mockAuditor({strict: false});
  const dao = new SimpleDao(config, null, auditor);
  await dao.save(Model.factory({a: 1}));
  assert.equal(auditor.calls.length, 0);
});

it("throws after save when strict and updatedBy missing", async () => {
  const auditor = mockAuditor({strict: true});
  const dao = new SimpleDao(config, null, auditor);
  await assert.rejects(
    () => dao.save(Model.factory({a: 1, accountId: "acc1"})),
    /audit identity missing/
  );
});
```

Use `new SimpleDao(config, null, auditor)` so the default `simpleDao` in `beforeEach` stays unaudited.

- [ ] **Step 2: Run the new tests — FAIL**

- [ ] **Step 3: Constructor + save hook**

```js
constructor(options, logger, auditor) {
  this.connectionString = getConnectionString(options.db);
  this.logger = logger;
  this.auditor = auditor || null;
}
```

After a successful `save`, if `this.auditor`:

```js
const {recordInsert} = require("./audit");
recordInsert(this.auditor, {model, collectionName, explicitUserId});
```

`recordInsert` in `src/audit.js`:

```js
function recordInsert(auditor, {model, collectionName, explicitUserId}) {
  if (!auditor) {
    return;
  }
  const userId = resolveUserId({model, explicitUserId});
  const accountId = scalarAccountId(model);
  const objectId = model && model._id;
  const missing = [];
  if (!hasRequired(objectId)) {
    missing.push("objectId");
  }
  if (!hasRequired(userId)) {
    missing.push("userId");
  }
  if (!hasRequired(accountId)) {
    missing.push("accountId");
  }
  if (missing.length) {
    if (auditor.strict) {
      throw missingIdentityError(missing);
    }
    return;
  }
  auditor.recordMongo({
    accountId,
    collectionName,
    objectId,
    userId,
    operation: "insert",
    payload: model
  });
}
```

- [ ] **Step 4: `npm test` — PASS**

---

### Task 3: `update` / `remove` / `removeById` + find-before-write

**Files:**
- Modify: `src/operator.js`, `src/audit.js`, `test/simple-dao_tests.js`

**Interfaces:**
- Produces: `update(query, update, options, userId)`, `remove(query, userId)`, `removeById(id, userId)`
- Produces: `resolveTargets(collection, query, {userId, accountIdHint}) → [{_id, accountId}]`
- Produces: `recordWrites(auditor, events)`

- [ ] **Step 1: Failing tests (auditor present)**

Cover:

1. `update` with `{_id, accountId}` and `$set.updatedBy` → one `recordMongo` (`operation: "update"`, `query`, `payload`), **no extra find needed** (assert by using a query that already has identity; optional: spy `collection.find` only if practical).
2. `update` by `{name: "x"}` with auditor → find then one event per matched doc (`multi: true` matches two).
3. `update` empty match → `n: 0`, `calls.length === 0`.
4. `update` strict, no `updatedBy` and no 4th arg → throw **before** write (document unchanged).
5. `remove(query, userId)` by non-`_id` query → find then `operation: "delete"` per id; `payload` omitted.
6. `removeById(id, userId)` with `accountId` only on the document → find for accountId, then delete event.
7. Mongo `update` throw (bad operator) → `recordMongo` not called.
8. No auditor → `update({}, {$set:{a:5}})` still works (existing tests).

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `resolveTargets` and `assertCanWrite` in `src/audit.js`**

```js
async function resolveTargets(collection, query, {accountIdHint} = {}) {
  const fromQuery = idsFromQuery(query);
  const accountId = accountIdHint || scalarAccountId(query);
  if (fromQuery.kind === "ids" && hasRequired(accountId)) {
    return fromQuery.ids.map((_id) => ({_id, accountId}));
  }
  const docs = await collection.find(query, {projection: {_id: 1, accountId: 1}}).toArray();
  return docs.map((doc) => ({
    _id: doc._id,
    accountId: hasRequired(accountId) ? accountId : doc.accountId
  }));
}

function recordUpdates(auditor, {targets, collectionName, userId, query, payload}) {
  if (!auditor || !hasRequired(userId)) {
    return;
  }
  for (const target of targets) {
    if (!hasRequired(target._id) || !hasRequired(target.accountId)) {
      continue;
    }
    auditor.recordMongo({
      accountId: target.accountId,
      collectionName,
      objectId: target._id,
      userId,
      operation: "update",
      query,
      payload
    });
  }
}

function recordDeletes(auditor, {targets, collectionName, userId, query}) {
  if (!auditor || !hasRequired(userId)) {
    return;
  }
  for (const target of targets) {
    if (!hasRequired(target._id) || !hasRequired(target.accountId)) {
      continue;
    }
    auditor.recordMongo({
      accountId: target.accountId,
      collectionName,
      objectId: target._id,
      userId,
      operation: "delete",
      query
    });
  }
}

function throwIfStrictMissing(auditor, userId, targets) {
  if (!auditor || !auditor.strict) {
    return;
  }
  if (!hasRequired(userId)) {
    throw missingIdentityError(["userId"]);
  }
  if (!targets.length) {
    return;
  }
  const missingAccount = targets.some((t) => !hasRequired(t.accountId) || !hasRequired(t._id));
  if (missingAccount) {
    throw missingIdentityError(["accountId"]);
  }
}
```

- [ ] **Step 4: Wire `Operator.update` / `remove` / `removeById`**

Pattern for `update`:

```js
async update(query, update, options, userId) {
  // existing null checks
  const db = await this.simpleDao.connect();
  const collection = db.collection(this.collectionName);
  const auditor = this.simpleDao.auditor;
  let targets = [];
  if (auditor) {
    const resolvedUserId = resolveUserId({update, explicitUserId: userId});
    const accountIdHint = scalarAccountId(update && update.$set) || scalarAccountId(query);
    targets = await resolveTargets(collection, query, {accountIdHint});
    throwIfStrictMissing(auditor, resolvedUserId, targets);
    const result = await collection.update(query, update, Operator.cleanOptions(options));
    // existing endResult mapping
    recordUpdates(auditor, {
      targets,
      collectionName: this.collectionName,
      userId: resolvedUserId,
      query,
      payload: update
    });
    return endResult;
  }
  // existing update path
}
```

`removeById` converts string id to ObjectID then `return this.remove({_id}, userId)`.

- [ ] **Step 5: `npm test` — PASS**

---

### Task 4: README + version

**Files:**
- Modify: `README.md`, `package.json`

- [ ] **Step 1:** Document `new SimpleDao(config, logger, auditor?)`, optional `userId` args, and that `auditor` is duck-typed (`recordMongo`, `strict`).

- [ ] **Step 2:** Set `"version": "4.7.0"`.

- [ ] **Step 3:** `npm test` — PASS.

- [ ] **Step 4: Commit (only if the user asks)**

```bash
git commit -m "$(cat <<'EOF'
CU-86bbe2byz feat: record Mongo writes through an optional auditor

EOF
)"
```
