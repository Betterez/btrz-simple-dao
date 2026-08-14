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

module.exports = {
  hasRequired,
  scalarId,
  idsFromQuery,
  resolveUserId,
  scalarAccountId,
  missingIdentityError,
  recordInsert
};
