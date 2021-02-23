const config = require('../config/config');

const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename : config.sqlite3.filename
    }
});

module.exports = knex ;
