const knex = require('./utils/db');
const blockchain = require('./blockchain');
const Loger = require('./utils/log');
const logger = new Loger('users').logger();

function sqliteInit() {
    knex.schema
        // address
        .createTableIfNotExists('address', table => {
            table.increments('id').notNullable();
            table.string('address').notNullable().defaultTo('');
            table.string('secret').notNullable().defaultTo('');
            table.bigInteger('balance').defaultTo(0);
            table.bigInteger('change_balance').defaultTo(0);
        })
        // txs
        .createTableIfNotExists('txs', table => {
            table.increments('id').notNullable();
            table.string('hash').notNullable();
            table.string('from').notNullable();
            table.string('to').notNullable();
            table.string('currency').defaultTo('AITD');
            table.string('amount').defaultTo('0');
            table.integer('status').defaultTo(1);
            table.integer('block').defaultTo(null);
            table.integer('sequence').defaultTo(null);
            table.string('errmsg').defaultTo(null);
            table.timestamps('time');
        })
        //ledger
        .createTableIfNotExists('ledgers', table => {
            table.increments('id').notNullable();
            table.string('hash').notNullable();
            table.integer('index').notNullable();
            table.string('close_time_human').notNullable();
            table.integer('transaction_count').defaultTo(0);
        })
        //contract_detail
        .createTableIfNotExists('contract_detail', table => {
            table.increments('id').notNullable();
            table.string('address').defaultTo(null);
            table.string('creater').notNullable();
            table.string('creater_secret').notNullable();
            table.string('name').defaultTo(null);
            table.string('symbol').defaultTo(null);
            table.string('total_coin').defaultTo(null);
            table.string('fee').defaultTo(null);
            table.string('transction_id').notNullable();
            table.integer('status').defaultTo(1);
            table.integer('block').defaultTo(null);
            table.integer('sequence').defaultTo(null);
            table.string('errmsg').defaultTo(null);
            table.timestamps('time');
        })
        //contract_txs
        .createTableIfNotExists('contract_txs', table => {
            table.increments('id').notNullable();
            table.string('hash').defaultTo(null);
            table.string('from').notNullable();
            table.string('contract_address').defaultTo(null);
            table.string('contract_data').defaultTo(null);
            table.string('fee').defaultTo(null);
            table.integer('status').defaultTo(1);
            table.integer('block').defaultTo(null);
            table.integer('sequence').defaultTo(null);
            table.string('errmsg').defaultTo(null);
            table.timestamps('time');
        })

        // Finally, add a .catch handler for the promise chain
        .catch(e => {
            console.error(e);
        });
}

function insertAccount(keypair, path) {
    return new Promise(async function (resolve, reject) {
        knex('address')
            .insert({
                address: keypair.address,
                secret: keypair.secret,
            })
            .then(function (resp) {
                logger.info('create an account successfully, resp: ', resp);
                resolve(resp);
            })
            .catch(function (err) {
                logger.error('create account fail, err: ', err.toString());
                resolve(1);
            });
    });
}

async function genAddress(count) {
    for (let i = 0; i < count; i++)
    {
        let keypair = blockchain.generateAddress();
        // console.log("address: ", keypair.address);
        await insertAccount(keypair);
    }
    logger.error('gen new address ', count);
}

async function getAllAddress(addressList)
{
    try {
        let accounts = await knex('address')
            .select('address')
            // .where('id', '>=', start)
            // .andWhere('id', '<', end)
            .andWhere('balance', '=', 0)
            .limit(500);
        accounts.forEach(function (item, index) {
            addressList.push(item.address);
        });
    } catch (error) {
        throw error;
    }
}

async function getAccountCount() {
    try {
        let id = await knex('address').max('id as a');
        return id[0].a;
    } catch (error) {
        throw error;
    }
}

async function getAccountInfo(accountList, start, end) {
    try {
        let accounts = await knex('address').select()
            .where('id', '>=', start)
            .andWhere('id', '<', end);
        accounts.forEach(function (item, index) {
            let tmp = {};
            tmp.id = item.id;
            tmp.address = item.address;
            tmp.secret = item.secret;
            tmp.balance = 0;
            // tmp.balance = item.balance;
            accountList.push(tmp);
        });
    } catch (error) {
        throw error;
    }
}

function update(id, balance) {
    return new Promise(async function (resolve, reject) {
        knex('address')
            .update({balance : balance})
            .where('id', '=', id)
            .then(function (resp) {
                logger.info('update an account balance, resp: ', resp);
                resolve(resp);
            })
            .catch(function (err) {
                logger.error('update account balance fail, err: ', err.toString());
                resolve(1);
            });
    });
}

async function updateBalance() {
    let maxId = await getAccountCount();
    // let maxId = 5;
    logger.info('max id : ', maxId);

    let start = 0;
    let step = 200;
    while (1) {
        let accountList = [];
        await getAccountInfo(accountList, start, start + step);
        logger.info('start : ', start , ' accountList len:  ', accountList.length);

        for (let i = 0; i < accountList.length; i++) {
            let a = await blockchain.getBalance(accountList[i].address);
            let balance = 0;
            if (a.error === undefined) {
                balance = +a[0].value;
            }
            await update(accountList[i].id, balance);
        }

        start += step;
        if (start > maxId) {
            logger.info('update account balance finish');
            break;
        }
    }
}

async function getAccount(accountList, start, end) {
    try {
        let accounts = await knex('address')
            .select('address')
            .where('id', '>=', start)
            .andWhere('id', '<', end)
            .andWhere('balance', '=', 0)
            .limit(200);
        accounts.forEach(function (item, index) {
            accountList.push(item.address);
        });
    } catch (error) {
        throw error;
    }
}

async function getRichAccount(accountList) {
    try {
        let accounts = await knex('address')
            .select()
            .andWhere('balance', '>=', 1000);
            // .limit(200);
        accounts.forEach(function (item, index) {
            let tmp = {};
            tmp.id = item.id;
            tmp.address = item.address;
            tmp.secret = item.secret;
            // tmp.prevNonce = -1;
            tmp.value = 50000;
            // tmp.prevTimestamp = 0;

            accountList.push(tmp);
        });
    } catch (error) {
        throw error;
    }
}

module.exports = {
    sqliteInit,
    genAddress,
    getAllAddress,
    updateBalance,
    getAccountCount,
    getRichAccount,
    getAccount,
    getAccountInfo
};