// TODO: split

import {
  DASHBOARD_ELECTRUM_BALANCE,
  DASHBOARD_ELECTRUM_TRANSACTIONS,
  DASHBOARD_ELECTRUM_COINS,
} from '../storeType';
import { translate } from '../../translate/translate';
import Config from '../../config';
import appData from './appData';
import {
  triggerToaster,
  sendToAddressState,
} from '../actionCreators';
import Store from '../../store';
import agamalib from '../../agamalib';
import proxyServers from '../../util/proxyServers';

export function shepherdSelectProxy() {
  // pick a random proxy server
  const _randomServer = proxyServers[agamalib.utils.getRandomIntInclusive(0, proxyServers.length - 1)];
  appData.proxy = {
    ip: _randomServer.ip,
    port: _randomServer.port,
  };
}

export function shepherdSelectRandomCoinServer(coin) {
  // pick a random proxy server
  const _randomServer = agamalib.eservers[coin].serverList[agamalib.utils.getRandomIntInclusive(0, agamalib.eservers[coin].serverList.length - 1)].split(':');
  appData.servers[coin] = {
    ip: _randomServer[0],
    port: _randomServer[1],
    proto: agamalib.eservers[coin].proto,
  };
}

export function shepherdElectrumLock() {
  return new Promise((resolve, reject) => {
    appData.auth.status = 'locked';
    appData.keys = {};
    resolve();
  });
}

export function shepherdElectrumLogout() {
  return new Promise((resolve, reject) => {
    appData.auth.status = 'locked';
    appData.keys = {};
    appData.coins = [];
    appData.allcoins = {
      spv: [],
      total: 0,
    };
    appData.servers = {};
    resolve();
  });
}

// src: atomicexplorer
export function shepherdGetRemoteBTCFees() {
  return new Promise((resolve, reject) => {
    fetch(`https://www.atomicexplorer.com/api/btc/fees`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .catch((error) => {
      console.log(error);
      Store.dispatch(
        triggerToaster(
          'shepherdGetRemoteBTCFees',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      resolve(json);
    });
  });
}

export function shepherdElectrumSetServer(coin, address, port) {
  return new Promise((resolve, reject) => {
    fetch(`http://127.0.0.1:${Config.agamaPort}/shepherd/electrum/coins/server/set?address=${address}&port=${port}&coin=${coin}&token=${Config.token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .catch((error) => {
      console.log(error);
      Store.dispatch(
        triggerToaster(
          'shepherdElectrumSetServer',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      resolve(json);
    });
  });
}

export function shepherdElectrumCheckServerConnection(address, port) {
  return new Promise((resolve, reject) => {
    fetch(`http://127.0.0.1:${Config.agamaPort}/shepherd/electrum/servers/test?address=${address}&port=${port}&token=${Config.token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .catch((error) => {
      console.log(error);
      Store.dispatch(
        triggerToaster(
          'shepherdElectrumCheckServerConnection',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      resolve(!json.result ? 'error' : json);
    });
  });
}

export function shepherdElectrumKeys(seed) {
  return new Promise((resolve, reject) => {
    const _keys = agamalib.keys.stringToWif(seed, agamalib.btcnetworks[Object.keys(appData.keys)[0]], true);

    if (_keys.priv === appData.keys[Object.keys(appData.keys)[0]].priv) {
      resolve({ result: appData.keys });
    } else {
      resolve('error');
    }
  });
}

export function shepherdElectrumBalance(coin, address) {
  return dispatch => {
    fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/getbalance?port=${appData.servers[coin].port}&ip=${appData.servers[coin].ip}&proto=${appData.servers[coin].proto}&address=${address}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .catch((error) => {
      console.log(error);
      dispatch(
        triggerToaster(
          'shepherdElectrumBalance',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      json = json.result;

      if (json &&
          json.hasOwnProperty('confirmed') &&
          json.hasOwnProperty('unconfirmed')) {

        if (coin === 'kmd') {
          shepherdElectrumListunspent(coin, address)
          .then((_utxoList) => {
            let _totalInterest = 0;

            for (let i = 0; i < _utxoList.length; i++) {
              if (Number(_utxoList[i].interest) > 0) {
                _totalInterest += Number(_utxoList[i].interest);
              }
            }

            json = {
              msg: 'success',
              result: {
                balance: Number((0.00000001 * json.confirmed).toFixed(8)),
                balanceSats: json.confirmed,
                unconfirmed: Number((0.00000001 * json.unconfirmed).toFixed(8)),
                unconfirmedSats: json.unconfirmed,
                interest: Number(_totalInterest.toFixed(8)),
                interestSats: Math.floor(_totalInterest * 100000000),
                total: _totalInterest > 0 ? Number((0.00000001 * json.confirmed + _totalInterest).toFixed(8)) : 0,
                totalSats: _totalInterest > 0 ? json.confirmed + Math.floor(_totalInterest * 100000000) : 0,
              },
            };
            dispatch(shepherdElectrumBalanceState(json));
          });
        } else {
          json = {
            msg: 'success',
            result: {
              balance: Number((0.00000001 * json.confirmed).toFixed(8)),
              balanceSats: json.confirmed,
              unconfirmed: Number((0.00000001 * json.unconfirmed).toFixed(8)),
              unconfirmedSats: json.unconfirmed,
            },
          };
          dispatch(shepherdElectrumBalanceState(json));
        }
      } else {
        json = {
          msg: 'error',
          result: 'error',
        };
        dispatch(shepherdElectrumBalanceState(json));
      }
    });
  }
}

export function shepherdElectrumBalanceState(json) {
  return {
    type: DASHBOARD_ELECTRUM_BALANCE,
    balance: json.result,
  }
}

export function shepherdElectrumTransactions(coin, address, full = true, verify = false) {
  return dispatch => {
    // get current height
    fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/getcurrentblock?port=${appData.servers[coin].port}&ip=${appData.servers[coin].ip}&proto=${appData.servers[coin].proto}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .catch((error) => {
      console.log(error);
      Store.dispatch(
        triggerToaster(
          'shepherdElectrumTransactions+getcurrentblock remote',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      let result = json;

      if (result.msg === 'error') {
        resolve('error');
      } else {
        const currentHeight = result.result;

        //console.warn('currentHeight =>');
        //console.warn(currentHeight);

        fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/listtransactions?port=${appData.servers[coin].port}&ip=${appData.servers[coin].ip}&proto=${appData.servers[coin].proto}&address=${address}&raw=true`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        .catch((error) => {
          console.log(error);
          Store.dispatch(
            triggerToaster(
              'shepherdElectrumTransactions+listtransactions remote',
              'Error',
              'error'
            )
          );
        })
        .then(response => response.json())
        .then(json => {
          result = json;

          if (result.msg !== 'error') {
            let _transactions = [];

            // parse listtransactions
            const json = result.result;

            if (json &&
                json.length) {
              let _rawtx = [];

              Promise.all(json.map((transaction, index) => {
                return new Promise((resolve, reject) => {
                  fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/getblockinfo?port=${appData.servers[coin].port}&ip=${appData.servers[coin].ip}&proto=${appData.servers[coin].proto}&address=${address}&height=${transaction.height}`, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  })
                  .catch((error) => {
                    console.log(error);
                    Store.dispatch(
                      triggerToaster(
                        'shepherdElectrumTransactions+getblockinfo remote',
                        'Error',
                        'error'
                      )
                    );
                  })
                  .then(response => response.json())
                  .then(json => {
                    result = json;

                    // console.warn('getblock =>');
                    // console.warn(result);

                    if (result.msg !== 'error') {
                      const blockInfo = result.result;

                      // console.warn('electrum gettransaction ==>');
                      // console.warn((index + ' | ' + (transaction.raw.length - 1)));
                      // console.warn(transaction.raw);

                      // decode tx
                      const _network = agamalib.coin.isKomodoCoin(coin) ? agamalib.btcnetworks.kmd : agamalib.btcnetworks[coin];
                      const decodedTx = agamalib.decoder(transaction.raw, _network);

                      let txInputs = [];

                      // console.warn('decodedtx =>');
                      // console.warn(decodedTx.outputs);

                      if (decodedTx &&
                          decodedTx.inputs) {
                        Promise.all(decodedTx.inputs.map((_decodedInput, index) => {
                          return new Promise((_resolve, _reject) => {
                            if (_decodedInput.txid !== '0000000000000000000000000000000000000000000000000000000000000000') {
                              fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/gettransaction?port=${appData.servers[coin].port}&ip=${appData.servers[coin].ip}&proto=${appData.servers[coin].proto}&address=${address}&txid=${_decodedInput.txid}`, {
                                method: 'GET',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                              })
                              .catch((error) => {
                                console.log(error);
                                Store.dispatch(
                                  triggerToaster(
                                    'shepherdElectrumTransactions+gettransaction remote',
                                    'Error',
                                    'error'
                                  )
                                );
                              })
                              .then(response => response.json())
                              .then(json => {
                                result = json;

                                // console.warn('gettransaction =>');
                                // console.warn(result);

                                if (result.msg !== 'error') {
                                  const decodedVinVout = agamalib.decoder(result.result, _network);

                                  // console.warn('electrum raw input tx ==>');

                                  if (decodedVinVout) {
                                    // console.warn(decodedVinVout.outputs[_decodedInput.n], true);
                                    txInputs.push(decodedVinVout.outputs[_decodedInput.n]);
                                    _resolve(true);
                                  } else {
                                    _resolve(true);
                                  }
                                }
                              });
                            } else {
                              _resolve(true);
                            }
                          });
                        }))
                        .then(promiseResult => {
                          const _parsedTx = {
                            network: decodedTx.network,
                            format: decodedTx.format,
                            inputs: txInputs,
                            outputs: decodedTx.outputs,
                            height: transaction.height,
                            timestamp: Number(transaction.height) === 0 ? Math.floor(Date.now() / 1000) : blockInfo.timestamp,
                            confirmations: Number(transaction.height) === 0 ? 0 : currentHeight - transaction.height,
                          };

                          const formattedTx = agamalib.transactionType(_parsedTx, address, coin === 'kmd' ? true : false);

                          if (formattedTx.type) {
                            formattedTx.height = transaction.height;
                            formattedTx.blocktime = blockInfo.timestamp;
                            formattedTx.timereceived = blockInfo.timereceived;
                            formattedTx.hex = transaction.raw;
                            formattedTx.inputs = decodedTx.inputs;
                            formattedTx.outputs = decodedTx.outputs;
                            formattedTx.locktime = decodedTx.format.locktime;
                            _rawtx.push(formattedTx);
                          } else {
                            formattedTx[0].height = transaction.height;
                            formattedTx[0].blocktime = blockInfo.timestamp;
                            formattedTx[0].timereceived = blockInfo.timereceived;
                            formattedTx[0].hex = transaction.raw;
                            formattedTx[0].inputs = decodedTx.inputs;
                            formattedTx[0].outputs = decodedTx.outputs;
                            formattedTx[0].locktime = decodedTx.format.locktime;
                            formattedTx[1].height = transaction.height;
                            formattedTx[1].blocktime = blockInfo.timestamp;
                            formattedTx[1].timereceived = blockInfo.timereceived;
                            formattedTx[1].hex = transaction.raw;
                            formattedTx[1].inputs = decodedTx.inputs;
                            formattedTx[1].outputs = decodedTx.outputs;
                            formattedTx[1].locktime = decodedTx.format.locktime;
                            _rawtx.push(formattedTx[0]);
                            _rawtx.push(formattedTx[1]);
                          }
                          resolve(true);
                        });
                      } else {
                        const _parsedTx = {
                          network: decodedTx.network,
                          format: 'cant parse',
                          inputs: 'cant parse',
                          outputs: 'cant parse',
                          height: transaction.height,
                          timestamp: Number(transaction.height) === 0 ? Math.floor(Date.now() / 1000) : blockInfo.timestamp,
                          confirmations: Number(transaction.height) === 0 ? 0 : currentHeight - transaction.height,
                        };

                        const formattedTx = agamalib.transactionType(_parsedTx, address, coin === 'kmd' ? true : false);
                        _rawtx.push(formattedTx);
                        resolve(true);
                      }
                    } else {
                      const _parsedTx = {
                        network: 'cant parse',
                        format: 'cant parse',
                        inputs: 'cant parse',
                        outputs: 'cant parse',
                        height: transaction.height,
                        timestamp: 'cant get block info',
                        confirmations: Number(transaction.height) === 0 ? 0 : currentHeight - transaction.height,
                      };
                      const formattedTx = agamalib.transactionType(_parsedTx, address, coin === 'kmd' ? true : false);
                      _rawtx.push(formattedTx);
                      resolve(true);
                    }
                  });
                });
              }))
              .then(promiseResult => {
                Store.dispatch(shepherdElectrumTransactionsState({ result: _rawtx }));
              });
            } else {
              // empty history
              Store.dispatch(shepherdElectrumTransactionsState({ result: [] }));
            }
          } else {
            Store.dispatch(shepherdElectrumTransactionsState({ error: 'error' }));
          }
        });
      }
    });
  }
}

export function shepherdElectrumTransactionsState(json) {
  json = json.result;

  if (json &&
      json.error) {
    json = null;
  } else if (!json || !json.length) {
    json = 'no data';
  }

  return {
    type: DASHBOARD_ELECTRUM_TRANSACTIONS,
    txhistory: json,
  }
}

export function shepherdElectrumCoins() {
  let _coins = {};

  for (let i = 0; i < appData.coins.length; i++) {
    if (appData.keys[appData.coins[i]]) {
      _coins[appData.coins[i]] = {
        pub: appData.keys[appData.coins[i]].pub,
      };
    } else {
      _coins[appData.coins[i]] = {};
    }
  }

  return dispatch => {
    return dispatch(shepherdElectrumCoinsState({ result: _coins }));
  }
}

export function shepherdElectrumCoinsState(json) {
  return {
    type: DASHBOARD_ELECTRUM_COINS,
    electrumCoins: json.result,
  }
}

// value in sats
export function shepherdElectrumSend(coin, value, sendToAddress, changeAddress, btcFee) {
  value = Math.floor(value);

  return dispatch => {
    return fetch(`http://127.0.0.1:${Config.agamaPort}/shepherd/electrum/createrawtx?coin=${coin}&address=${sendToAddress}&value=${value}&change=${changeAddress}${btcFee ? '&btcfee=' + btcFee : ''}&gui=true&push=true&verify=true&token=${Config.token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .catch((error) => {
      console.log(error);
      dispatch(
        triggerToaster(
          'shepherdElectrumSend',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      dispatch(sendToAddressState(json.msg === 'error' ? json : json.result));
    });
  }
}

export function shepherdElectrumSendPromise(coin, value, sendToAddress, changeAddress, fee, push) {
  value = Math.floor(value);

  return new Promise((resolve, reject) => {
    shepherdElectrumListunspent(coin, changeAddress)
    .then((utxoList) => {
      let _network;

      if (agamalib.coin.isKomodoCoin(coin)) {
        _network = agamalib.btcnetworks.kmd;
      } else {
        _network = agamalib.btcnetworks[coin];
      }

      const _data = agamalib.transactionBuilder.data(
        _network,
        value,
        fee,
        sendToAddress,
        changeAddress,
        utxoList
      );

      // console.warn('send data', _data);

      const _tx = agamalib.transactionBuilder.transaction(
        sendToAddress,
        changeAddress,
        appData.keys[coin].priv,
        _network,
        _data.inputs,
        _data.change,
        _data.value
      );

      // TODO: err
      // console.warn('send tx', _tx);

      if (push) {
        fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/pushtx`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            port: appData.servers[coin].port,
            ip: appData.servers[coin].ip,
            proto: appData.servers[coin].proto,
            rawtx: _tx,
          }),
        })
        .catch((error) => {
          console.log(error);
          Store.dispatch(
            triggerToaster(
              'shepherdElectrumSetServer',
              'Error',
              'error'
            )
          );
        })
        .then(response => response.json())
        .then(json => {
          let result = json;

          if (result.msg === 'error') {
            const _err = {
              msg: 'error',
              result: 'pushtx failed',
            };
            Store.dispatch(sendToAddressState(_err));
          } else {
            const txid = json.result;

            const _rawObj = {
              utxoSet: _data.inputs,
              change: _data.change,
              changeAdjusted: _data.change,
              totalInterest: _data.totalInterest,
              fee: _data.totalInterest,
              value: _data.value,
              outputAddress: sendToAddress,
              changeAddress,
              rawtx: _tx,
              txid,
              utxoVerified: _data.utxoVerified,
            };

            if (txid &&
                txid.indexOf('bad-txns-inputs-spent') > -1) {
              const successObj = {
                msg: 'error',
                result: 'Bad transaction inputs spent',
                raw: _rawObj,
              };

              Store.dispatch(sendToAddressState(successObj));
            } else {
              if (txid &&
                  txid.length === 64) {
                if (txid.indexOf('bad-txns-in-belowout') > -1) {
                  const successObj = {
                    msg: 'error',
                    result: 'Bad transaction inputs spent',
                    raw: _rawObj,
                  };

                  Store.dispatch(sendToAddressState(successObj));
                } else {
                  const successObj = {
                    result: _rawObj,
                    txid: _rawObj.txid,
                  };

                  Store.dispatch(sendToAddressState(successObj));
                }
              } else {
                if (txid &&
                    txid.indexOf('bad-txns-in-belowout') > -1) {
                  const successObj = {
                    msg: 'error',
                    result: 'Bad transaction inputs spent',
                    raw: _rawObj,
                  };

                  dispatch(sendToAddressState(successObj));
                } else {
                  const successObj = {
                    msg: 'error',
                    result: 'Can\'t broadcast transaction',
                    raw: _rawObj,
                  };

                  Store.dispatch(sendToAddressState(successObj));
                }
              }
            }
          }
        });
      } else {
        resolve({
          msg: 'success',
          result: {
            fee: _data.fee,
            value: _data.value,
            change: _data.change,
            utxoVerified: _data.utxoVerified,
            estimatedFee: _data.estimatedFee,
          },
        });
      }
    });
  });
}

export function shepherdElectrumListunspent(coin, address, full = true, verify = false) {
  const CONNECTION_ERROR_OR_INCOMPLETE_DATA = 'connection error or incomplete data';
  let _atLeastOneDecodeTxFailed = false;

  if (full) {
    return new Promise((resolve, reject) => {
      fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/listunspent?port=${appData.servers[coin].port}&ip=${appData.servers[coin].ip}&proto=${appData.servers[coin].proto}&address=${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .catch((error) => {
        console.log(error);
        Store.dispatch(
          triggerToaster(
            'shepherdElectrumListunspent+listunspent remote',
            'Error',
            'error'
          )
        );
      })
      .then(response => response.json())
      .then(json => {
        // console.warn('shepherdElectrumListunspent', json);
        let result = json;

        if (result.msg === 'error') {
          resolve('error');
        } else {
          const _utxoJSON = result.result;

          if (_utxoJSON &&
              _utxoJSON.length) {
            let formattedUtxoList = [];
            let _utxo = [];

            fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/getcurrentblock?port=${appData.servers[coin].port}&ip=${appData.servers[coin].ip}&proto=${appData.servers[coin].proto}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            })
            .catch((error) => {
              console.log(error);
              Store.dispatch(
                triggerToaster(
                  'shepherdElectrumTransactions+getcurrentblock remote',
                  'Error',
                  'error'
                )
              );
            })
            .then(response => response.json())
            .then(json => {
              result = json;
              // get current height

              if (result.msg === 'error') {
                resolve('cant get current height');
              } else {
                const currentHeight = result.result;

                if (currentHeight &&
                    Number(currentHeight) > 0) {
                  // filter out unconfirmed utxos
                  for (let i = 0; i < _utxoJSON.length; i++) {
                    if (Number(currentHeight) - Number(_utxoJSON[i].height) !== 0) {
                      _utxo.push(_utxoJSON[i]);
                    }
                  }

                  if (!_utxo.length) { // no confirmed utxo
                    resolve('no valid utxo');
                  } else {
                    Promise.all(_utxo.map((_utxoItem, index) => {
                      return new Promise((resolve, reject) => {
                        fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/gettransaction?port=${appData.servers[coin].port}&ip=${appData.servers[coin].ip}&proto=${appData.servers[coin].proto}&address=${address}&txid=${_utxoItem['tx_hash']}`, {
                          method: 'GET',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                        })
                        .catch((error) => {
                          console.log(error);
                          Store.dispatch(
                            triggerToaster(
                              'shepherdElectrumTransactions+gettransaction remote',
                              'Error',
                              'error'
                            )
                          );
                        })
                        .then(response => response.json())
                        .then(json => {
                          result = json;

                          // console.warn(result);

                          if (result.msg !== 'error') {
                            // console.warn('gettransaction =>');
                            const _rawtxJSON = result.result;

                            // console.warn('electrum gettransaction ==>');
                            // console.warn(index + ' | ' + (_rawtxJSON.length - 1));
                            // console.warn(_rawtxJSON);

                            // decode tx
                            const _network = agamalib.coin.isKomodoCoin(coin) ? agamalib.btcnetworks.kmd : agamalib.btcnetworks[coin];
                            const decodedTx = agamalib.decoder(_rawtxJSON, _network);

                            // console.warn('decoded tx =>');
                            // console.warn(decodedTx);

                            if (!decodedTx) {
                              _atLeastOneDecodeTxFailed = true;
                              resolve('cant decode tx');
                            } else {
                              if (coin === 'kmd') {
                                let interest = 0;

                                if (Number(_utxoItem.value) * 0.00000001 >= 10 &&
                                    decodedTx.format.locktime > 0) {
                                  // console.warn('interest', agamalib.komodoInterest);
                                  interest = agamalib.komodoInterest(decodedTx.format.locktime, _utxoItem.value);
                                }

                                let _resolveObj = {
                                  txid: _utxoItem['tx_hash'],
                                  vout: _utxoItem['tx_pos'],
                                  address,
                                  amount: Number(_utxoItem.value) * 0.00000001,
                                  amountSats: _utxoItem.value,
                                  interest: interest,
                                  interestSats: Math.floor(interest * 100000000),
                                  confirmations: Number(_utxoItem.height) === 0 ? 0 : currentHeight - _utxoItem.height,
                                  spendable: true,
                                  verified: false,
                                  locktime: decodedTx.format.locktime,
                                };

                                // merkle root verification agains another electrum server
                                if (verify) {
                                  verifyMerkleByCoin(
                                    _utxoItem['tx_hash'],
                                    _utxoItem.height,
                                    electrumServer,
                                    proxyServer
                                  ).then((verifyMerkleRes) => {
                                    if (verifyMerkleRes &&
                                        verifyMerkleRes === CONNECTION_ERROR_OR_INCOMPLETE_DATA) {
                                      verifyMerkleRes = false;
                                    }

                                    _resolveObj.verified = verifyMerkleRes;
                                    resolve(_resolveObj);
                                  });
                                } else {
                                  resolve(_resolveObj);
                                }
                              } else {
                                let _resolveObj = {
                                  txid: _utxoItem['tx_hash'],
                                  vout: _utxoItem['tx_pos'],
                                  address,
                                  amount: Number(_utxoItem.value) * 0.00000001,
                                  amountSats: _utxoItem.value,
                                  confirmations: Number(_utxoItem.height) === 0 ? 0 : currentHeight - _utxoItem.height,
                                  spendable: true,
                                  verified: false,
                                };

                                // merkle root verification agains another electrum server
                                if (verify) {
                                  verifyMerkleByCoin(
                                    _utxoItem['tx_hash'],
                                    _utxoItem.height,
                                    electrumServer,
                                    proxyServer
                                  ).then((verifyMerkleRes) => {
                                    if (verifyMerkleRes &&
                                        verifyMerkleRes === CONNECTION_ERROR_OR_INCOMPLETE_DATA) {
                                      verifyMerkleRes = false;
                                    }

                                    _resolveObj.verified = verifyMerkleRes;
                                    resolve(_resolveObj);
                                  });
                                } else {
                                  resolve(_resolveObj);
                                }
                              }
                            }
                          } else {
                            resolve(false);
                            _atLeastOneDecodeTxFailed = true;
                            // console.warn('getcurrentblock error =>');
                          }
                        });
                      });
                    }))
                    .then(promiseResult => {
                      if (!_atLeastOneDecodeTxFailed) {
                        // console.warn(promiseResult);
                        resolve(promiseResult);
                      } else {
                        // console.warn('listunspent error, cant decode tx(s)');
                        resolve('decode error');
                      }
                    });
                  }
                } else {
                  resolve('cant get current height');
                }
              }
            });
          } else {
            resolve(CONNECTION_ERROR_OR_INCOMPLETE_DATA);
          }
        }
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      fetch(`${Config.https ? 'https' : 'http'}://${appData.proxy.ip}:${appData.proxy.port}/api/listunspent?port=${appData.servers[coin].port}&ip=${appData.servers[coin].ip}&proto=${appData.servers[coin].proto}&address=${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .catch((error) => {
        console.log(error);
        Store.dispatch(
          triggerToaster(
            'shepherdElectrumListunspent+listunspent remote',
            'Error',
            'error'
          )
        );
      })
      .then(response => response.json())
      .then(json => {
        resolve(json.msg === 'error' ? 'error' : json.result);
      });
    });
  }
}

export function shepherdElectrumBip39Keys(seed, match, addressdepth, accounts) {
  return new Promise((resolve, reject) => {
    fetch(`http://127.0.0.1:${Config.agamaPort}/shepherd/electrum/seed/bip39/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        seed,
        match,
        addressdepth,
        accounts,
        token: Config.token,
      }),
    })
    .catch((error) => {
      console.log(error);
      Store.dispatch(
        triggerToaster(
          'shepherdElectrumSetServer',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      resolve(json);
    });
  });
}

// split utxo
export function shepherdElectrumSplitUtxoPromise(payload) {
  console.warn(payload);

  return new Promise((resolve, reject) => {
    return fetch(`http://127.0.0.1:${Config.agamaPort}/shepherd/electrum/createrawtx-split`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload,
        token: Config.token,
      }),
    })
    .catch((error) => {
      console.log(error);
      Store.dispatch(
        triggerToaster(
          'shepherdElectrumSendPromise',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      resolve(json);
    });
  });
}