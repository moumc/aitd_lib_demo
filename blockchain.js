const api = require('./api');
const knex = require('./utils/db');
const Loger = require('./utils/log');
const logger = new Loger('users').logger();
const sleep = require('sleep');

const CURRENCY = 'AITD';

function quit(message) {
    console.log(message);
    // process.exit(0);
}

function fail(message) {
    console.error(message);
    // process.exit(1);
}

function generateAddress()
{
    return api.generateAddress();
}

function getAccountInfo(address) {
    return new Promise(async function (resolve, reject) {
        api.connect().then(() => {
            api.getAccountInfo(address).then(info => {
                resolve(info);
            }).catch(e => {
                resolve({error: true});
            });
        });
    });
}
//
// function getBalance(address) {
//     return new Promise(async function (resolve, reject) {
//         api.connect().then(() => {
//             api.getBalances(address).then(balances => {
//                 resolve(balances);
//             }).catch(e => {
//                 resolve({error: true});
//             });
//         });
//     });
// }

function getBalance(address) {
    return new Promise(async function (resolve, reject) {
        api.connect().then(() => {
            api.getBalances(address).then(balances => {
                resolve(balances);
            }).catch(e => {
                resolve({error: true});
            });
        });
    });
}

// 一个账号给其它多个账号
async function oneToMore(fromList)
{
    const address = 'arU7exfNcZkNU3Awir5z3ik96KZjwWKzUx';
    const secret = 'sn8mQYrqsy1mjBYD7t2znuYKr9Nt3';

    let info = await getAccountInfo(address);
    if (info.error)
        return;
    let prevSequence = 0;

    for (let i = 0; i < fromList.length; i++)
    {
        // let sequence = 0;
        // do {
        //     let info = await getAccountInfo(address);
        //     if (info.error)
        //     {
        //         logger.error('Get ', address,  ' account info error');
        //         return;
        //     }
        //     sequence = info.sequence;
        //     sleep.sleep(1);
        // } while (sequence <= prevSequence)
        // prevSequence = sequence;

        let value = '10000000000';
        let resp = await transfer(address, fromList[i], value, secret);
        if (resp.error) {
            logger.error('transfer from', address , "to", fromList[i], value, "AITD", 'transfer error');
            continue;
        }
        await insertTx(resp);
        logger.info('transfer from', address , "to", fromList[i], value, "AITD" , "hash", resp.tx_json.hash);
    }
    logger.info('oneToMore do finish, total to ', fromList.length, ' address');
}

function insertTx(tx) {
    return new Promise(function (resolve, reject) {
        knex('txs')
            .insert({
                hash: tx.tx_json.hash,
                from: tx.tx_json.Account,
                to: tx.tx_json.Destination,
                amount: tx.tx_json.Amount
            })
            .then(function (resp) {
                // logger.info('insert an tx successfully, resp: ', resp);
                resolve(resp);
            })
            .catch(function (err) {
                logger.error('create account fail, err: ', err.toString());
                resolve(1);
            });
    });
}

async function moreToMore(fromList, toList, count) {
    let from = "";
    let to = "";
    let value = 0;
    let secret = "";

    let num = fromList.length > toList.length ? toList.length: fromList.length;
    for (let i = 0; i < num; i++) {
        from = fromList[i].address.toString();
        value = fromList[i].value;
        secret = fromList[i].secret;
        to = toList[i].toString();

        let resp = await transfer(from, to, value, secret);
        count[0].count++;
        if (resp.error) {
            logger.error('transfer from', from, "to", to, value, "AITD", 'transfer error');
            continue;
        }

        await insertTx(resp);
        logger.info('transfer from', from , "to", to, value, "AITD" , "hash", resp.tx_json.hash);
    }
}

function transfer(from, to, value, secret) {
    return new Promise(async function (resolve, reject) {
        const instructions = {maxLedgerVersionOffset: 5};
        const payment = {
            source: {
                address: from,
                maxAmount: {
                    value: value.toString(),
                    currency: CURRENCY
                }
            },
            destination: {
                address: to,
                amount: {
                    value: value.toString(),
                    currency: CURRENCY
                }
            }
        };

        api.connect().then(() => {
            api.preparePayment(from, payment, instructions).then(prepared => {
                const {signedTransaction} = api.sign(prepared.txJSON, secret);
                api.submit(signedTransaction).then( result => {
                    if (result.engine_result === 'tesSUCCESS' && result.engine_result_code === 0) {
                        resolve(result);
                    } else {
                        resolve({error: true, errormsg: 'unknown error.'});
                    }
                }).catch(e => {
                    resolve({error: true});
                });
            });
        }).catch(fail);
    });
}

async function getSheetCount(sheet) {
    try {
        let id = await knex(sheet).max('id as a');
        return id[0].a;
    } catch (error) {
        throw error;
    }
}

async function getTxInfo(txList, start, end, sheet) {
    try {
        let infos = await knex(sheet)
            .select('id', 'hash')
            .where('id', '>=', start)
            .andWhere('id', '<', end)
            .andWhere('status', '=', 1);
            // .whereNull('block');
        infos.forEach(function (item, index) {
            let tmp = {};
            tmp.id = item.id;
            tmp.hash = item.hash;

            txList.push(tmp);
        });
    } catch (error) {
        throw error;
    }
}

function getTransactionByHash(hash) {
    return new Promise(async function (resolve, reject) {
        api.connect().then(() => {
            api.getTransaction(hash).then(transaction  => {
                resolve(transaction);
            }).catch(e => {
                resolve({error: true});
            });
        });
    });
}

async function updateTx(id, transaction, sheet) {
    await knex(sheet)
        .update({status : 0, block: transaction.outcome.ledgerVersion, sequence: transaction.sequence})
        .where('id', '=', id)
        .then(function (resp) {
            logger.info('update an tx , resp: ', resp, ', id', id);
        })
        .catch(function (err) {
            logger.error('update tx fail, err: ', err.toString());
        });
}

async function updateTxs(txList, sheet) {
    for (let i = 0; i < txList.length; i++) {
        try {
            let transaction = await getTransactionByHash(txList[i].hash);
            if (transaction.error) {
                logger.error('transfer hash', txList[i].hash, 'not found.');
                continue;
            }

            await updateTx(txList[i].id, transaction, sheet);
        } catch (e) {
            logger.error('updateTxs err : ', e.toString());
        }
    }
}

async function transferSelf(fromInfo, count) {
    let from = "";
    let to = "";
    let value = 0;
    let secret = "";

    let num = fromInfo.length;
    for (let i = 0; i < num; i++) {
        from = fromInfo[i].address.toString();
        value = 0.000001;
        secret = fromInfo[i].secret;
        to = fromInfo[num - i - 1].address.toString();

        if (from === to)
            continue;

        for (let j = 0; j < 1; j++) {
            // console.log(from, to, secret, value);
            let resp = await transfer(from, to, value, secret);
            count[0].count++;
            if (resp.error) {
                logger.error('transfer from', from, "to", to, value, "AITD", 'transfer error');
                break;
            }

            await insertTx(resp);
            logger.info('transfer from', from , "to", to, value, "AITD" , "hash", resp.tx_json.hash);
        }
        // sleep.sleep(1);
    }
}

function getLedger(index)
{
    return new Promise(async function (resolve, reject) {
        api.connect().then(() => {
            api.getLedger({ledgerVersion: index, includeTransactions: true}).then(ledger  => {
                resolve(ledger);
            }).catch(e => {
                resolve({error: true});
            });
        });
    });
}

function insertLedger(ledger) {
    return new Promise(function (resolve, reject) {
        knex('ledgers')
            .insert({
                hash: ledger.ledgerHash,
                index: ledger.ledgerVersion,
                close_time_human: ledger.closeTime,
                transaction_count: ledger.hasOwnProperty('transactionHashes') ?  ledger.transactionHashes.length : 0
            })
            .then(function (resp) {
                // logger.info('insert an tx successfully, resp: ', resp);
                resolve(resp);
            })
            .catch(function (err) {
                logger.error('create account fail, err: ', err.toString());
                resolve(1);
            });
    });
}

async function getLedgers(start, end)
{
    for (let i = start; i <= end; i++) {
        let resp = await getLedger(i);
        if (resp.error)
        {
            logger.error('get ledger', i, 'error.');
            continue;
        }

        if (resp.hasOwnProperty('transactionHashes')) {
            await insertLedger(resp);
            logger.info('insert ledger', i );
        }
    }
    logger.info('get ledger', start, 'to', end, 'finish.');
}

module.exports = {
    oneToMore,
    getBalance,
    generateAddress,
    getAccountInfo,
    moreToMore,
    transfer,
    getSheetCount,
    getTxInfo,
    updateTxs,
    getTransactionByHash,
    transferSelf,
    getLedgers
};