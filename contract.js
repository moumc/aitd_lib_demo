const api = require('./api');
const knex = require('./utils/db');
const Loger = require('./utils/log');
const blockchain = require('./blockchain');
const address = require('./address');

const logger = new Loger('users').logger();
const sleep = require('sleep');
const fs = require('fs');

function quit(message) {
    console.log(message);
    // process.exit(0);
}

function fail(message) {
    console.error(message);
    // process.exit(1);
}

function contract(from, data, secret, fee, amount, to) {
    return new Promise(async function (resolve, reject) {
        const instructions = {maxLedgerVersionOffset: 5, maxFee: '100000000'};
        const contract = {
            source: from,
            contractData: data.toUpperCase(),
            fee: fee,
            amount: amount,
            };

        if (to !== '' && to !== undefined) {
            contract.contractAddress = to;
        }

        api.connect().then(() => {
            api.prepareContract(from, contract, instructions).then(contract => {
                const {signedTransaction} = api.sign(contract.txJSON, secret);
                api.submit(signedTransaction).then( result => {
                    if ((result.engine_result === 'tesSUCCESS' && result.engine_result_code === 0) ||
                        result.engine_result === 'terQUEUED' ) {

                        if (result.engine_result === 'terQUEUED') {
                            logger.info('engine_result: ', result.engine_result, 'txid ', result.tx_json.hash);
                        }

                        resolve(result);
                    } else {
                        console.log('result: ', result)
                        sleep.sleep(1);
                        resolve({error: true, errormsg: 'unknown error.'});
                    }
                }).catch(e => {
                    console.log(e);
                    sleep.sleep(1);
                    resolve({error: true});
                });
            });
        }).catch(fail);
    });
}

function insertContract(tx, secret) {
    return new Promise(function (resolve, reject) {
        knex('contract_detail')
            .insert({
                transction_id: tx.tx_json.hash,
                creater: tx.tx_json.Account,
                fee: tx.tx_json.Fee,
                creater_secret: secret
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

function insertContractTx(tx) {
    return new Promise(function (resolve, reject) {
        knex('contract_txs')
            .insert({
                hash: tx.tx_json.hash,
                from: tx.tx_json.Account,
                contract_address: tx.tx_json.ContractAddress,
                contract_data: tx.tx_json.ContractData,
                fee: tx.tx_json.Fee
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

async function createContract()
{
    let contractData = fs.readFileSync('./config/erc20.evm', "utf8");
    let fee = '20000000';

    let fromList = [];
    await address.getRichAccount(fromList);

    for (let i = 0; i < fromList.length; i++) {
        let from = fromList[i].address;
        let secret = fromList[i].secret;
        let amount = "20000000";
        let resp = await contract(from, contractData, secret, fee, amount);
        if (resp.error) {
            logger.error(from, 'create contract error');
            continue;
        }
        await insertContract(resp, secret);
        logger.info('create contract', "transction hash", resp.tx_json.hash);
    }
}

async function updateTxs(txList, sheet)
{
    await blockchain.updateTxs(txList, sheet);
}

async function getContractInfo(txList, start, end) {
    try {
        let infos = await knex('contract_detail')
            .select('id', 'transction_id')
            .where('id', '>=', start)
            .andWhere('id', '<', end)
            .andWhere('status', '=', 1);
        // .whereNull('block');
        infos.forEach(function (item, index) {
            let tmp = {};
            tmp.id = item.id;
            tmp.hash = item.transction_id;

            txList.push(tmp);
        });
    } catch (error) {
        throw error;
    }
}

async function updateTx(id, transaction, tx) {
    let address = '';
    let AffectedNodes = tx.meta.AffectedNodes;
    for (let i = 0; i < AffectedNodes.length; i++) {
        let node = AffectedNodes[i];
        if (node.hasOwnProperty('CreatedNode')) {
            address = node.CreatedNode.NewFields.Account;
        }
    }

    await knex('contract_detail')
        .update({address: address, status : 0, block: transaction.outcome.ledgerVersion, sequence: transaction.sequence})
        .where('id', '=', id)
        .then(function (resp) {
            logger.info('update an contract tx , resp: ', resp, ', id', id);
        })
        .catch(function (err) {
            logger.error('update tx fail, err: ', err.toString());
        });
}

async function updateContract(txList)
{
    for (let i = 0; i < txList.length; i++) {
        try {
            let transaction = await blockchain.getTransactionByHash(txList[i].hash);
            if (transaction.error) {
                logger.error('transfer hash', txList[i].hash, 'not found.');
                continue;
            }
            // console.log(transaction);
            let tx = JSON.parse(transaction.rawTransaction)
            await updateTx(txList[i].id, transaction, tx);
        } catch (e) {
            logger.error('updateTxs err : ', e.toString());
        }
    }
}

async function getContractAddress(addressList, start, end)
{
    try {
        let infos = await knex('contract_detail')
            .select('id', 'address', 'creater', 'creater_secret')
            .where('id', '>=', start)
            .andWhere('id', '<', end)
            .andWhere('status', '=', 0);
        // .whereNull('block');
        infos.forEach(function (item, index) {
            let tmp = {};
            tmp.id = item.id;
            tmp.address = item.address;
            tmp.creater = item.creater;
            tmp.creater_secret = item.creater_secret;

            addressList.push(tmp);
        });
    } catch (error) {
        throw error;
    }
}

async function callContract1(addressList)
{
    function pad(num, n) {
        let str = num.toString(16);
        let len = str.length;

        while (len < n) {
            str = "0" + str;
            len++;
        }
        return str;
    }

    let sendToAmount = 1;
    for (let i = 0; i < addressList.length; i++) {
        try {
            for (let j = 0; j < 1; j++)
            {
                let from = addressList[i].creater;
                let fee = '30';
                let secret = addressList[i].creater_secret;
                let to = addressList[i].address;

                // aPcNzotr6B8YBokhYtcTNqQVCngtbnWfux  f7fd027f816e04259de7bcea1058956fc51a3b61
                let contractData = 'a9059cbb000000000000000000000000c350be1dd9dda71a2f28ac04bbcbcf1b0eb4283d' + pad(sendToAmount++, 64);

                let resp = await contract(from, contractData, secret, fee, '0', to);
                if (resp.error) {
                    logger.error(from, 'call contract error');
                    sleep.sleep(1);
                    continue;
                }
                await insertContractTx(resp);
                logger.info('contract transfer', "transction hash", resp.tx_json.hash);
                sleep.sleep(1);
            }
        } catch (e) {
            logger.error('updateTxs err : ', e.toString());
        }
    }
}

async function callContract()
{
    let maxId = await blockchain.getSheetCount('contract_detail');
    logger.info('max id : ', maxId);

    let start = 0;
    let step = 200;
    while (1) {
        let addressList = [];
        await getContractAddress(addressList, start, start + step);
        logger.info('start : ', start , ' toList len:  ', addressList.length);

        if (addressList.length > 0) {
            await callContract1(addressList);
        }

        start += step;
        if (start > maxId) {
            logger.info('callContract finish');
            break;
        }
    }
}

module.exports = {
    createContract,
    callContract,
    updateTxs,
    updateContract,
    getContractInfo,
    getContractAddress
};
