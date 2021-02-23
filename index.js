const address = require("./address");
const blockchain = require("./blockchain");
const contract = require("./contract");
const Loger = require('./utils/log');
const logger = new Loger('users').logger();
const api = require('./api');

const sleep = require('sleep');

async function genAddressList() {
    logger.info('Start  genAddressList.');
    // await address.sqliteInit();
    await address.genAddress(10);
    logger.info('End  genAddressList.');
}

async function transferOneToMore() {
    logger.info('Start  transferOneToMore.');
    let fromList = [];
    await address.getAllAddress(fromList);
    logger.info('Get address: ', fromList.length);
    await blockchain.oneToMore(fromList);
    logger.info('End  transferOneToMore.');
}

async function transferMoreToMore() {
    logger.info('Start  transferMoreToMore.');
    let maxId = await address.getAccountCount();
    logger.info('max id : ', maxId);

    let fromList = [];
    await address.getRichAccount(fromList);
    logger.info( ' fromList len:  ', fromList.length);
    // console.log('fromList: ', fromList);

    let start = 0;
    let step = 500;
    let count = [{count: 0}];
    while (1) {
        let toList = [];
        await address.getAccount(toList, start, start + step);
        logger.info('start : ', start , ' toList len:  ', toList.length);
        // console.log('toList: ', toList);

        if (fromList.length > 0 && toList.length > 0) {
            await blockchain.moreToMore(fromList, toList, count);
        } else {
            logger.info('one list is empty.');
        }

        start += step;
        if (start > maxId) {
            logger.info('transfer account finish');
            break;
        }
    }
    logger.info('End  transferMoreToMore.');
}

async function updateBalance() {
    logger.info('Start  updateBalance.');
    await address.updateBalance();
    logger.info('End  updateBalance.');
}

async function updateTxs(isContract) {
    logger.info('Start  updateTxs.', isContract);
    let sheet = isContract ? 'contract_txs' : 'txs';
    let maxId = await blockchain.getSheetCount(sheet);
    logger.info('max id : ', maxId);

    let start = 0;
    let step = 200;
    while (1) {
        let txList = [];
        await blockchain.getTxInfo(txList, start, start + step, sheet);
        logger.info('start : ', start , ' toList len:  ', txList.length);

        if (txList.length > 0) {
            if (isContract) {
                await contract.updateTxs(txList, sheet);
            }
            else {
                await blockchain.updateTxs(txList, sheet);
            }
        }

        start += step;
        if (start > maxId) {
            logger.info('update txs finish');
            break;
        }
    }
    logger.info('End  updateTxs.', isContract);
}

function testTransfer()
{
    let from = 'arU7exfNcZkNU3Awir5z3ik96KZjwWKzUx';
    let to = 'aPcNzotr6B8YBokhYtcTNqQVCngtbnWfux';
    let value = 0.000001;
    let secret = 'sn8mQYrqsy1mjBYD7t2znuYKr9Nt3';

    blockchain.transfer(from, to, value, secret);

    // let hash = 'CC8349ACE5D79A80F7AB38241F6E3EC60852993490B8A61C259FA317B98745B6';
    // blockchain.getTransactionByHash(hash);
}

async function transferSelf() {
    logger.info('Start  transferSelf.');
    let maxId = await address.getAccountCount();
    logger.info('max id : ', maxId);

    let start = 0;
    let step = 500;
    let count = [{count: 0}];
    while (1) {
        let fromList = [];
        await address.getAccountInfo(fromList, start, start + step);
        logger.info('start : ', start , ' toList len:  ', fromList.length);

        if (fromList.length > 0) {
            await blockchain.transferSelf(fromList, count);
        }

        start += step;
        if (start > maxId) {
            logger.info('transferSelf transfer finish');
            break;
        }
    }
    logger.info('End  transferSelf.');
}

async function getLedgers()
{
    logger.info('Start  getLedgers.');
    let start = 45175;
    let end = 45382;

    await blockchain.getLedgers(start, end);
    logger.info('End  createContract.');
}

async function createContract()
{
    logger.info('Start  createContract.');
    let ret = await contract.createContract();
    logger.info('End  createContract.');
}

async function callContract()
{
    logger.info('Start  callContract.');
    let ret = await contract.callContract();
    logger.info('End  callContract.');
}

async function updateContract()
{
    logger.info('Start  updateContract.');
    let maxId = await blockchain.getSheetCount('contract_detail');
    logger.info('max id : ', maxId);

    let start = 0;
    let step = 200;
    while (1) {
        let txList = [];
        await contract.getContractInfo(txList, start, start + step);
        logger.info('start : ', start , ' toList len:  ', txList.length);

        if (txList.length > 0) {
            await contract.updateContract(txList);
        }

        start += step;
        if (start > maxId) {
            logger.info('update txs finish');
            break;
        }
    }
    logger.info('End  updateContract.');
}

async function start() {
    await address.sqliteInit();
    // await genAddressList();
    // await transferOneToMore();
    // await updateBalance();
    // sleep.sleep(10);
    // await updateBalance();
    // await transferMoreToMore();
    // await updateBalance();
    // while(true) {
    //     await transferSelf();
    // }
    // await transferSelf();
    // await updateBalance();
    // await testTransfer();
    // await updateTxs();
    // await getLedgers();
    //
    // await createContract();
    // sleep.sleep(15);
    // await updateContract();
    let count = 0;
    while (true) {
        logger.info('start count: ', count);
        // await transferSelf();
        await callContract();
        logger.info('end count: ', count);
        count++;
    }
    // await callContract();
    // await updateTxs(true);
}

start();

