
function _buildModel(factory) {
  return function (model) {
    return factory(model);
  };
}

module.exports = {
  buildModel: _buildModel
};
