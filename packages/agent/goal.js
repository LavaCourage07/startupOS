'use strict';

const goalModule = require('./dist/goal.cjs');

module.exports = Object.assign(goalModule.default || goalModule, goalModule);
