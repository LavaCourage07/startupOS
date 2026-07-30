'use strict';

const { createJiti } = require('jiti');

const jiti = createJiti(__filename, {
  interopDefault: false,
  moduleCache: true,
});

module.exports = function loadRuntime(specifier) {
  return jiti(specifier);
};
