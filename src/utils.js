"use strict";
function _buildModel(factory) {
  return function (model) {
    return factory(model);
  };
}

function _mapFor(factory) {
  return function findHandler(models) {
    return models.map(_buildModel(factory));
  };
}

module.exports = {
  buildModel: _buildModel,
  mapFor: _mapFor
};
