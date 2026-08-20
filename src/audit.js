"use strict";

function hasRequired(value) {
  return value !== undefined && value !== null && value !== "";
}

function scalarId(value) {
  if (!hasRequired(value)) {
    return null;
  }
  if (typeof value !== "object") {
    return value;
  }
  if (value.$in) {
    return null;
  }
  if (value._bsontype === "ObjectId" || (value.constructor && value.constructor.name === "ObjectID")) {
    return value;
  }
  return null;
}

function idsFromQuery(query) {
  if (!query || query._id == null) {
    return {kind: "unknown"};
  }
  const id = scalarId(query._id);
  if (id != null) {
    return {kind: "ids", ids: [id]};
  }
  if (query._id.$in && Array.isArray(query._id.$in)) {
    return {kind: "ids", ids: query._id.$in};
  }
  return {kind: "unknown"};
}

function resolveUserId({model, update, explicitUserId} = {}) {
  if (hasRequired(explicitUserId)) {
    return explicitUserId;
  }
  if (model && hasRequired(model.updatedBy)) {
    return model.updatedBy;
  }
  if (update && update.$set && hasRequired(update.$set.updatedBy)) {
    return update.$set.updatedBy;
  }
  return undefined;
}

function normalizeContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function resolveAccountId({model, query, update, explicitAccountId} = {}) {
  if (hasRequired(explicitAccountId)) {
    const fromContext = scalarAccountId({accountId: explicitAccountId});
    if (fromContext !== undefined) {
      return fromContext;
    }
  }
  const fromModel = scalarAccountId(model);
  if (fromModel !== undefined) {
    return fromModel;
  }
  const fromQuery = scalarAccountId(query);
  if (fromQuery !== undefined) {
    return fromQuery;
  }
  return scalarAccountId(update && update.$set);
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

function optionalFolder(folder) {
  if (!hasRequired(folder)) {
    return undefined;
  }
  return folder;
}

function mongoEvent(fields, folder) {
  const event = fields;
  const resolvedFolder = optionalFolder(folder);
  if (resolvedFolder !== undefined) {
    event.folder = resolvedFolder;
  }
  return event;
}

function missingIdentityError(fields) {
  return new Error(`[btrz-simple-dao] audit identity missing: ${fields.join(", ")}`);
}

function recordInsert(auditor, {model, collectionName, context}) {
  if (!auditor) {
    return;
  }
  const {userId, accountId, folder} = normalizeContext(context);
  const resolvedUserId = resolveUserId({model, explicitUserId: userId});
  const resolvedAccountId = resolveAccountId({model, explicitAccountId: accountId});
  const objectId = model && model._id;
  const missing = [];
  if (!hasRequired(objectId)) {
    missing.push("objectId");
  }
  if (!hasRequired(resolvedUserId)) {
    missing.push("userId");
  }
  if (!hasRequired(resolvedAccountId)) {
    missing.push("accountId");
  }
  if (missing.length) {
    if (auditor.strict) {
      throw missingIdentityError(missing);
    }
    return;
  }
  auditor.recordMongo(mongoEvent({
    accountId: resolvedAccountId,
    collectionName,
    objectId,
    userId: resolvedUserId,
    operation: "insert",
    payload: model
  }, folder));
}

async function resolveTargets(collection, query, {accountIdHint} = {}) {
  const fromQuery = idsFromQuery(query);
  const accountId = accountIdHint || scalarAccountId(query);
  if (fromQuery.kind === "ids") {
    return fromQuery.ids.map((_id) => ({_id, accountId}));
  }
  const docs = await collection.find(query, {projection: {_id: 1}}).toArray();
  return docs.map((doc) => ({
    _id: doc._id,
    accountId
  }));
}

async function recordUpdates(auditor, {targets, collectionName, userId, query, payload, multi, folder}) {
  if (!auditor) {
    return;
  }
  const resolved = await Promise.resolve(targets);
  const list = multi === true ? resolved : resolved.slice(0, 1);
  throwIfStrictMissing(auditor, userId, list);
  if (!hasRequired(userId)) {
    return;
  }
  for (const target of list) {
    if (!hasRequired(target._id) || !hasRequired(target.accountId)) {
      continue;
    }
    auditor.recordMongo(mongoEvent({
      accountId: target.accountId,
      collectionName,
      objectId: target._id,
      userId,
      operation: "update",
      query,
      payload
    }, folder));
  }
}

async function recordDeletes(auditor, {targets, collectionName, userId, query, folder}) {
  if (!auditor) {
    return;
  }
  const list = await Promise.resolve(targets);
  throwIfStrictMissing(auditor, userId, list);
  if (!hasRequired(userId)) {
    return;
  }
  for (const target of list) {
    if (!hasRequired(target._id) || !hasRequired(target.accountId)) {
      continue;
    }
    auditor.recordMongo(mongoEvent({
      accountId: target.accountId,
      collectionName,
      objectId: target._id,
      userId,
      operation: "delete",
      query
    }, folder));
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

module.exports = {
  hasRequired,
  scalarId,
  idsFromQuery,
  resolveUserId,
  resolveAccountId,
  normalizeContext,
  scalarAccountId,
  missingIdentityError,
  recordInsert,
  resolveTargets,
  recordUpdates,
  recordDeletes,
  throwIfStrictMissing
};
