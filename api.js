'use strict';
const config = require('./config/config');

const AitdAPI = require('aitd-lib').AitdAPI; // require('aitd-lib')

const api = new AitdAPI({server: config.node.url, maxFeeAITD: '100000000'});

module.exports = api;