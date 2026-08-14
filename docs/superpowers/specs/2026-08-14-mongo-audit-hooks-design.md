# Mongo audit hooks in SimpleDao — Design

**Date:** 2026-08-14  
**Repo:** `btrz-simple-dao`  
**ClickUp:** [CU-86bbe2byz](https://app.clickup.com/t/86bbe2byz)  
**Depends on:** [CU-86bbe21v9](https://app.clickup.com/t/86bbe21v9) (`btrz-panopticon` `strict` + `recordMongo`)  
**Status:** Draft

## Goal

When an optional `auditor` is passed into `SimpleDao`, every successful Mongo write (`save`, `update`, `remove`, `removeById`) records one `recordMongo` event per document. Callers that omit the auditor behave exactly as today.

This library does **not** depend on `btrz-panopticon`. It duck-types:

```js
auditor.strict // boolean
auditor.recordMongo({accountId, collectionName, objectId, userId, operation, query?, payload?})
```

## Non-goals

- npm dependency on `btrz-panopticon`
- Postgres
- Calling `recordMongo` from API commands (that is accounts / other APIs)
- Changing Mongo write results (`n`, `nModified`, returned models)

## Constructor

```js
new SimpleDao(options, logger, auditor?)
```

- `auditor` omitted / `null` / `undefined` → no audit, no extra `find`.
- Store `this.auditor = auditor || null`.
- `Operator` reads `this.simpleDao.auditor`.

## Write signatures (backward compatible)

```js
dao.save(model, userId?)
dao.for(Model).update(query, update, options?, userId?)
dao.for(Model).remove(query, userId?)
dao.for(Model).removeById(id, userId?)
```

`userId` on `update` is the **fourth** argument so `{multi: true}` is not treated as a user id. Callers who skip `options` pass `undefined`:

```js
dao.for(Model).update(query, {$set: {...}}, undefined, userId)
```

## Identity rules

Audit is useless without `objectId`, `userId`, and `accountId`. No `_unkeyed` keys, no `"unknown"` user.

**`userId` order:** `model.updatedBy` (save) or `update.$set.updatedBy` (update), else the explicit argument, else missing.

**`accountId` order:** `model.accountId` / scalar `query.accountId` / `$set.accountId` / `accountId` on documents returned by the pre-write find. A query value is scalar only if it is not `null` and not a plain object (so `$in` / `$eq` objects are ignored).

**`objectId`:** `model._id` after save; query `_id` (scalar or `$in`); else `_id` from the pre-write find.

## Extra find (only when `auditor` is present)

If `query._id` is a scalar or `{ $in: [...] }` **and** `userId` and `accountId` are already resolved, do not find.

Otherwise, before `update` / `remove`:

```js
collection.find(query, {projection: {_id: 1, accountId: 1}}).toArray()
```

Empty match → perform the write as today; emit no events; not an error.

If `_id` is known but `accountId` is not, still find `{_id, accountId}`.

## When to throw (`auditor.strict === true`)

- **save:** Mongo write first (need generated `_id`). Then if `_id`, `userId`, or `accountId` is still missing, throw.
- **update / remove:** if `userId` is missing, throw **before** the write. After resolving targets, if any target is missing `accountId` or `_id`, throw **before** the write.
- Empty find result is not a throw.

When `strict` is false/absent: missing identity → skip `recordMongo` for that document (or all, if `userId` is missing); never throw from audit. Still perform the Mongo write.

If `recordMongo` itself throws (panopticon `strict`), let it propagate after the write for save; for update/remove, identity should already be valid so panopticon should not throw.

Do not call `recordMongo` if the Mongo write threw.

Do not `await` `recordMongo` (it returns `undefined`).

## Event shapes

| Method | `operation` | `query` | `payload` |
|--------|-------------|---------|-----------|
| `save` | `insert` | omitted | the saved model |
| `update` | `update` | the filter | the update doc |
| `remove` / `removeById` | `delete` | the filter (`{_id}` for `removeById`) | omitted |

`collectionName` is the same name SimpleDao already uses (`collectionName()` or constructor name lowercased).

Fan-out: one `recordMongo` per `_id`. Panopticon stays one event per object.

## Module layout

```text
src/audit.js          # resolve ids, userId, accountId; find; record fan-out; strict
src/simple-dao.js     # constructor auditor; save hooks
src/operator.js       # update / remove / removeById hooks
test/audit_tests.js   # pure helpers
test/simple-dao_tests.js  # integration with mock auditor + Mongo
```

Bump version to `4.7.0`.
