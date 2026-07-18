const knex = require('knex');
const knex_config = require('../../knexfile');
const env = require('../config/env');

const connection = knex(knex_config[env.node_env] || knex_config.development);

module.exports = connection;
