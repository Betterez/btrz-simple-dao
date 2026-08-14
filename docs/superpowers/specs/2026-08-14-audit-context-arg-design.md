# Audit context argument — Design

**Date:** 2026-08-14  
**Repo:** `btrz-simple-dao`  
**ClickUp:** [CU-86bbe2byz](https://app.clickup.com/t/86bbe2byz)  
**Amends:** `4.8.0` (`docs/superpowers/specs/2026-08-14-mongo-audit-hooks-design.md`)  
**Status:** Draft

## Goal

Callers can pass audit identity without writing `accountId` onto the document. Some collections (Account) use `_id` as the account and must not gain an `accountId` field. `updatedBy` may still be persisted.

Replace the optional last `userId` argument with an object-only context. Nothing in production used the string `userId` API.

## Non-goals

- Loading `accountId` from a pre-write find
- Accepting a bare string as the last argument
- Changing Mongo write results
- Changing `auditor` / `recordMongo` shape
- Accounts call-site fixes (those stay in CU-86bbe2bz0 after this ships)

## Write signatures

```js
dao.save(model, context?)
dao.for(Model).update(query, update, options?, context?)
dao.for(Model).remove(query, context?)
dao.for(Model).removeById(id, context?)
```

`context` is omitted, `undefined`, or:

```js
{accountId, userId}
```

Both fields are optional. A string last argument is not accepted (treated as missing identity, not as `userId`).

`context` on `update` stays the **fourth** argument so `{multi: true}` is not treated as context. Callers who skip `options` pass `undefined`:

```js
dao.for(Account).update(query, {$pull: pull, $set: {updatedBy}}, undefined, {accountId, userId})
```

## Identity rules

**`userId` order:** `context.userId` → `model.updatedBy` (save) → `update.$set.updatedBy` (update) → missing.

**`accountId` order:** `context.accountId` → `model.accountId` (save) → scalar `query.accountId` → `$set.accountId` → missing.

A query / `$set` value is scalar only if it is not `null` and not a plain object (`$in` / `$eq` objects are ignored). `accountId` is never read from documents returned by the pre-write find.

**`objectId`:** unchanged (`model._id` after save; query `_id` scalar or `$in`; else `_id` from the pre-write find).

## Extra find

Unchanged from 4.8.0: only when an auditor is present and `query._id` is not already a scalar or `$in`. Projection is `{_id: 1}` (no `accountId`).

## Strict / prod

Unchanged from 4.8.0:

- `auditor.strict === true`: write first, then await audit; missing identity rejects after the write.
- `auditor.strict === false`: fire-and-forget; log errors; do not delay or fail the write.

`removeById` can record when `context.accountId` is provided (query remains `{_id}`).

## Version

`4.9.0` via `npm version minor` after the feature commit.
