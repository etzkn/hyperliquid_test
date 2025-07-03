
/*
 * @Author: Nw1996
 * @Date: 2025-01-27 09:08:46
 * @LastEditors: Nw1996
 * @LastEditTime: 2025-01-27 12:05:11
 * @Description: 
 * @FilePath: /hyperliquid/examples/ws_test.cjs
 */
const { Hyperliquid } = require("../dist/index.js");
const fs = require('fs');
const path = require('path');
const axios = require('axios');
// const { sendToWeChat } = require("../dist/index.js");
// require("dotenv").config();

const bigOrder1M = 20000000;
const bigOrder2M = 100000000;

const orderVol1M = 300;
const orderVol2M = 1000;

const leverage1 = 20;
const leverage2 = 50;

const private_key = "0x560ef5362577de1f96ce462b3adb5747d0ca433d035f4f73b434d010baf9f586";
const my_address = "0x3D9df980B3AE251A9B719c4c3fE6aCb84bd3B93C";

//cqy test
// const user_address = "0x8C2a1daEc7c7Cd8C9047aC82f699A499d5849C71"

// const user_address = "0x644f7170fae9d4d173d9217f03b7a77e22ed98f1"
const testnet = false// false for mainnet, true for testnet
const vaultAddress = null // or your vault address
const hlsdk = new Hyperliquid({
    privateKey: private_key,
    testnet: testnet,
    walletAddress: my_address,
    vaultAddress: vaultAddress,
    maxReconnectAttempts: 100
});
function subInfos(address) {
    //get start timestamp
    const startTieme = Date.now();
    for(const user of address){
        console.log("subInfos ",user)
        hlsdk.subscriptions.subscribeToOrderUpdates(user, (data => {
            data.map(async v => {
                try {
                    // console.log('===subscribeToOrderUpdates user===', user)
                    // console.log('===subscribeToOrderUpdates===', v)
                   
                    if (v.statusTimestamp < startTieme) {
                        return;
                    }
                    if (v.status !== 'filled') {
                        // console.log('===subscribeToOrderUpdates not filled===', v)
                        return;
                    }
    
                    if (!v.order.coin.includes('-PERP')) {
                        // console.log('===subscribeToOrderUpdates not PERP===', v)
                        return;
                    }
    
                    const vol = Number(v.order.limitPx) * Number(v.order.origSz);
                    if (vol < bigOrder1M) {
                        // console.log('===subscribeToOrderUpdates vol<bigOrder1M===', v)
                        return;
                    }
    
                    console.log('===subscribeToOrderUpdates user===', user)
                    console.log('===subscribeToOrderUpdates===', v)

                    //check leverage
                    const hold = await getPosition(user, v.order.coin);
                    if (hold && hold.position.maxLeverage < leverage1) {
                        console.log('===subscribeToOrderUpdates leverage<leverage1===', v)
                        return;
                    }
    
    
                    if (v.order.side==='buy') {//open position
    
                        //send order
                        //    const coinDecimal =  await hlsdk.info.perpetuals.getMeta().then(meta => {
                        //         for(const u of meta.universe){
                        //             console.log('===subscribeToOrderUpdates meta===', u)
                        //             if(u.name === v.order.coin){
                        //                 return u.szDecimals;
                        //             }
                        //         }
    
                        //         return -1;
                        //     });
    
                        //     if(coinDecimal === -1){
                        //         console.log('===subscribeToOrderUpdates coinDecimal===', coinDecimal)
                        //         return;
                        //     }
    
                        let orderVol = orderVol1M;
                        if(vol>bigOrder2M){
                            orderVol=orderVol2M;
                        }
                        let orderSz = (orderVol / Number(v.order.limitPx)).toFixed(2)
                        let orderPrice = (Number(v.order.limitPx) * 1).toFixed(5)
                        console.log('===subscribeToOrderUpdates new order===', orderVol, orderSz, orderPrice)
                        // Place an order
    
                        await hlsdk.exchange.placeOrder({
                            coin: v.order.coin,
                            is_buy: true,
                            sz: Number(orderSz),
                            limit_px: Number(orderPrice),
                            order_type: { limit: { tif: 'Gtc' } },
                            reduce_only: false,
    
                        }).then(placeOrderResult => {
                            const re = v.order.coin+" "+JSON.stringify(placeOrderResult);
                            console.log(re);
                            sendToWeChat(re);
                        }).catch(error => {
                            console.error('Error placing order:', error);
                        });
    
                    } else {//close position
    
                        //send order
                        //    const coinDecimal =  await hlsdk.info.perpetuals.getMeta().then(meta => {
                        //         for(const u of meta.universe){
                        //             console.log('===subscribeToOrderUpdates meta===', u)
                        //             if(u.name === v.order.coin){
                        //                 return u.szDecimals;
                        //             }
                        //         }
    
                        //         return -1;
                        //     });
    
                        //     if(coinDecimal === -1){
                        //         console.log('===subscribeToOrderUpdates coinDecimal===', coinDecimal)
                        //         return;
                        //     }
    
                       
                        let orderVol = orderVol1M;
                        if(vol>bigOrder2M){
                            orderVol=orderVol2M;
                        }
                        let ssize = (orderVol / Number(v.order.limitPx)).toFixed(2)
                        const myhold = await getPosition(my_address, v.order.coin);
                        if (!myhold) {
                            console.log('===subscribeToOrderUpdates no hold position===') 
                   
                        }else{
                            ssize =  Math.abs(Number(myhold.position.szi))
                        }
    
                        let orderPrice = (Number(v.order.limitPx) * 1).toFixed(5)
                        // let orderPrice = Number(v.order.limitPx);
                        console.log('===subscribeToOrderUpdates new order close===', orderVol, ssize, orderPrice)
                        // Place an order
                        await hlsdk.exchange.placeOrder({
                            coin: v.order.coin,
                            is_buy: false,
                            sz:Number(ssize),
                            limit_px: Number(orderPrice),
                            order_type: { limit: { tif: 'Gtc' } },
                            reduce_only: false,
    
                        }).then(placeOrderResult => {
    
                            const re = v.order.coin+" "+JSON.stringify(placeOrderResult);
                            console.log(re);
                            sendToWeChat(re);
                        }).catch(error => {
                            console.error('Error placing order:', error);
                        });
    
                    }
                }
                catch (error) {
                    console.error('Error:', error);
                }
    
            })// data.map(async v =>
    
    
        }));
      
    }



}


async function getPosition(user, coin) {
    return hlsdk.info.perpetuals.getClearinghouseState(user).then(clearinghouseState => {
        // console.log(clearinghouseState);
        //for each  clearinghouseState.assetPositions
        for (const assetPosition of clearinghouseState.assetPositions) {
            if (assetPosition.position.coin === coin) {
                console.log('===subscribeToOrderUpdates leverage===', assetPosition.position.maxLeverage);
                // return assetPosition.position.maxLeverage;
                return assetPosition;
            }
        }

        return undefined;

    })
}

function readWalletAddresses(filepath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filepath, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }

            // 按行分割并过滤空行
            const walletAddresses = data
                .split('\n') // 按行分割
                .map(line => line.trim()) // 去除前后空格
                .filter(line => line !== ''); // 过滤空行

            resolve(walletAddresses);
        });
    });
}

async function getPosition(user,coin){
    return hlsdk.info.perpetuals.getClearinghouseState(user).then(clearinghouseState => {
        // console.log(clearinghouseState);
        //for each  clearinghouseState.assetPositions
        for (const assetPosition of clearinghouseState.assetPositions) {
            if (assetPosition.position.coin === coin) {
                console.log('===subscribeToOrderUpdates leverage===', assetPosition.position.maxLeverage);
                // return assetPosition.position.maxLeverage;
                return assetPosition;
            }
        }

        return undefined;

    })
}

 async function sendToWeChat(message) {
    const webhookURL = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=3334e15e-363a-4576-862b-938f664ea174";
    const payload = {
        msgtype: "text",
        text: {
            content: message,
        },
    };

    await axios.post(webhookURL, payload, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
async function testWs() {
    try {
        sendToWeChat("hyperliquid copy trade run")
        await hlsdk.connect();
        console.log('Connected to WebSocket');
        //read wallet address from wallet.txt
        //get current path
        const currentDirectory = process.cwd();

        console.log('当前目录路径:', currentDirectory);
        const address = await readWalletAddresses('./examples/wallet.txt');
        console.log(address)
        subInfos(address)

    
        // setTimeout(() => {
        //     console.log('User CancleConnected to WebSocket');
        //     hlsdk.disconnect()
        // }, 5*1000);
        // reconnect
        hlsdk.ws.on('reconnect', () => {
            subInfos(address)
        })


        // Get all tradable assets
        // const allAssets = hlsdk.custom.getAllAssets();
        // console.log(allAssets);

        // Get user's perpetuals account summary
        // hlsdk.info.perpetuals.getClearinghouseState(user_address).then(clearinghouseState => {
        //     console.log(clearinghouseState);
        //     clearinghouseState.assetPositions.map(v => {
        //         console.log('===assetPositions===', v);
        //     })

        // }).catch(error => {
        //     console.error('Error getting clearinghouse state:', error);
        // });

    } catch (error) {
        console.error('Error:', error);
    }
}
testWs()
