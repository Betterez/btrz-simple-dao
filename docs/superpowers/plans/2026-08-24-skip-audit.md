# skipAudit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let callers opt a Mongo write out of panopticon with `context.skipAudit === true`.

**Architecture:** Add `shouldSkipAudit(context)` in `src/audit.js`. `recordInsert` returns before identity checks when skip is set. `Operator.update` / `remove` skip the extra find and `recordMongo` when skip is set. Strict mode does not throw on skipped writes.

**Tech Stack:** Node.js CommonJS, `node:test`, existing Mongo integration tests.

## Global Constraints

- ClickUp: [CU-86bbkcz29](https://app.clickup.com/t/86bbkcz29)
- Repo: `btrz-simple-dao`
- Only boolean `true` skips; omitted / `false` / `null` keep current audit
- No panopticon changes; no collection denylist
- Bump to `4.11.0`
- TDD; no `btrz-panopticon` dependency

---

### Task 1: `shouldSkipAudit` and `save`

**Files:**
- Modify: `src/audit.js`, `src/simple-dao.js` (save already calls `recordInsert`)
- Test: `test/audit_tests.js`, `test/simple-dao_tests.js`

**Produces:** `shouldSkipAudit(context) → boolean`. `recordInsert` no-ops when skip is true.

- [ ] **Step 1: Write failing unit tests** in `test/audit_tests.js`

```js
it("shouldSkipAudit is true only for boolean true", () => {
  assert.equal(shouldSkipAudit({skipAudit: true}), true);
  assert.equal(shouldSkipAudit({skipAudit: false}), false);
  assert.equal(shouldSkipAudit({skipAudit: null}), false);
  assert.equal(shouldSkipAudit({}), false);
  assert.equal(shouldSkipAudit(undefined), false);
  assert.equal(shouldSkipAudit("true"), false);
});
```

- [ ] **Step 2: Write failing save tests** in `.save() > with auditor`

```js
it("does not call recordMongo when context.skipAudit is true", async () => {
  const auditor = mockAuditor();
  const dao = new SimpleDao(config, null, auditor);
  const saved = await dao.save(Model.factory({a: 1, accountId: "acc1", updatedBy: "u1"}), {
    skipAudit: true
  });
  assert.ok(saved._id);
  assert.equal(auditor.calls.length, 0);
});

it("does not throw in strict mode when skipAudit is true and identity is missing", async () => {
  const auditor = mockAuditor({strict: true});
  const dao = new SimpleDao(config, null, auditor);
  const saved = await dao.save(Model.factory({a: 1}), {skipAudit: true});
  assert.ok(saved._id);
  assert.equal(auditor.calls.length, 0);
});

it("still records insert when skipAudit is false", async () => {
  const auditor = mockAuditor();
  const dao = new SimpleDao(config, null, auditor);
  await dao.save(Model.factory({a: 1, accountId: "acc1", updatedBy: "u1"}), {skipAudit: false});
  assert.equal(auditor.calls.length, 1);
});
```

- [ ] **Step 3: Run tests and confirm they fail**

Run: `node --test --test-force-exit test/audit_tests.js test/simple-dao_tests.js`

- [ ] **Step 4: Implement**

```js
function shouldSkipAudit(context) {
  return normalizeContext(context).skipAudit === true;
}

function recordInsert(auditor, {model, collectionName, context}) {
  if (!auditor || shouldSkipAudit(context)) {
    return;
  }
  // existing identity + recordMongo
}
```

Export `shouldSkipAudit`.

- [ ] **Step 5: Re-run tests until green**

---

### Task 2: `update` / `remove` / `removeById`

**Files:**
- Modify: `src/operator.js`
- Test: `test/simple-dao_tests.js`

**Produces:** When `skipAudit === true`, no extra find, no `recordMongo`, no strict throw; Mongo write still happens.

- [ ] **Step 1: Write failing tests**

Update (query without `_id` so a find would normally run):

```js
it("does not call recordMongo or find when skipAudit is true", async () => {
  await simpleDao.save(Model.factory({name: "x", a: 1, accountId: "acc1"}));
  const auditor = mockAuditor({strict: true});
  const dao = new SimpleDao(config, null, auditor);
  const findSpy = mock.method(Collection.prototype, "find");
  const result = await dao.for(Model).update(
    {name: "x", accountId: "acc1"},
    {$set: {a: 9, updatedBy: "u1"}},
    undefined,
    {skipAudit: true}
  );
  await waitForAuditToSettle();
  assert.equal(result.n, 1);
  assert.equal(auditor.calls.length, 0);
  assert.equal(findSpy.mock.callCount(), 0);
});
```

Remove:

```js
it("does not call recordMongo or find when skipAudit is true", async () => {
  const seeded = await simpleDao.save(Model.factory({name: "x", accountId: "acc1"}));
  const auditor = mockAuditor({strict: true});
  const dao = new SimpleDao(config, null, auditor);
  const findSpy = mock.method(Collection.prototype, "find");
  const result = await dao.for(Model).remove(
    {name: "x", accountId: "acc1"},
    {userId: "u1", skipAudit: true}
  );
  await waitForAuditToSettle();
  assert.equal(result.n, 1);
  assert.equal(auditor.calls.length, 0);
  assert.equal(findSpy.mock.callCount(), 0);
  const db = await dao.connect();
  assert.equal(await db.collection(collectionName).findOne({_id: seeded._id}), null);
});
```

removeById:

```js
it("does not call recordMongo when skipAudit is true", async () => {
  const seeded = await simpleDao.save(Model.factory({a: 1}));
  const auditor = mockAuditor({strict: true});
  const dao = new SimpleDao(config, null, auditor);
  const result = await dao.for(Model).removeById(seeded._id, {
    accountId: "acc1",
    userId: "u1",
    skipAudit: true
  });
  await waitForAuditToSettle();
  assert.equal(result.n, 1);
  assert.equal(auditor.calls.length, 0);
});
```

- [ ] **Step 2: Confirm fail**

- [ ] **Step 3: In `update` and `remove`, treat auditor as absent when skipping**

```js
const skipAudit = shouldSkipAudit(context);
if (auditor && !skipAudit) {
  // existing find + later recordUpdates / recordDeletes
}
```

- [ ] **Step 4: Re-run tests until green**

---

### Task 3: README and version

**Files:**
- Modify: `README.md`, `package.json`

- [ ] Document `skipAudit: true` next to `{accountId, userId, folder}`
- [ ] Note: no extra find, no `recordMongo`, no strict throw; write still happens
- [ ] Bump `package.json` to `4.11.0`
- [ ] ESLint; `npm test`
