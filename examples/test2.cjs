const { Hyperliquid } = require("../dist/index.js");
const axios = require('axios');

// 自定义策略参数
const bigOrder1M = 0;
const bigOrder2M = 1000000;

const orderVol1M = 12;
const orderVol2M = 12;

const leverage1 = 0;

// 你的钱包私钥和地址
const private_key = "d9e4fbc076335ed753da8651722d7799a20deeca46b0d4b1a0e032a82305642f";
const my_address = "0x2948E31Ce2034845E4Ea20C7a076d71E8694317D";

const testnet = false;
const vaultAddress = null;

// 多个目标地址：手动从 leaderboard 上挑选 10-20 个活跃钱包放进来
const target_addresses = [
    "0x77c3ea550d2da44b120e55071f57a108f8dd5e45",
    "0x9794bbbc222b6b93c1417d01aa1ff06d42e5333b",
    "0x716bd8d3337972db99995dda5c4b34d954a61d95",
    "0xcb92c5988b1d4f145a7b481690051f03ead23a13",
    "0xfae95f601f3a25ace60d19dbb929f2a5c57e3571",
    "0x51156f7002c4f74f4956c9e0f2b7bfb6e9dbfac2",
    "0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00",
    "0xa350d83fdcc7ac81dfaedea1a87108401ccb015f",
    "0xb83de012dba672c76a7dbbbf3e459cb59d7d6e36",
    "0x0d0707963952f2fba59dd06f2b425ace40b492fe",
    "0xbde2ddc49a2e6827300faa6afc93d572114a60b1",
    "0xc4ff1b50648213bdb064bea8c9e25bfa0606f93a",
    "0x7f0269d7438a27811e6fa0fc33b51a79ea79be9e",
    "0x5b5d51203a0f9079f8aeb098a6523a13f298c060",
    "0xbdfa4f4492dd7b7cf211209c4791af8d52bf5c50",
    "0xcfdb74a8c080bb7b4360ed6fe21f895c653efff4",
    "0x0d446c3372a9ba9cddef0eef7a1afab6dc0e8c0b",
    "0x493db0ed7514c975e9abcc110bd40c473b6763e3",
    "0x4e14fc11f58b64740e66e4b1aa188a4b007c0eab",
    "0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23"
];

const hlsdk = new Hyperliquid({
    privateKey: private_key,
    testnet,
    walletAddress: my_address,
    vaultAddress,
    maxReconnectAttempts: 100
});

async function getPosition(user, coin) {
    return hlsdk.info.perpetuals.getClearinghouseState(user).then(state => {
        for (const pos of state.assetPositions) {
            if (pos.position.coin === coin) {
                console.log('Leverage:', pos.position.maxLeverage);
                return pos;
            }
        }
        return undefined;
    });
}

async function sendToWeChat(message) {
    const webhookURL = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=3334e15e-363a-4576-862b-938f664ea174";
    const payload = {
        msgtype: "text",
        text: { content: message }
    };
    await axios.post(webhookURL, payload, { headers: { 'Content-Type': 'application/json' } });
}

function subMultiple(addresses) {
    const startTimestamp = Date.now();
    for (const addr of addresses) {
        console.log("📡 正在监听地址:", addr);
        hlsdk.subscriptions.subscribeToOrderUpdates(addr, data => {
            data.map(async v => {
                try {
                    if (v.statusTimestamp < startTimestamp) return;
                    if (v.status !== 'filled') return;
                    if (!v.order.coin.includes('-PERP')) return;

                    const vol = Number(v.order.limitPx) * Number(v.order.origSz);
                    if (vol < bigOrder1M) return;

                    const hold = await getPosition(addr, v.order.coin);
                    if (hold && hold.position.maxLeverage < leverage1) return;

                    console.log(`📥 ${addr} 满足下单条件:`, v);

                    let orderVol = vol > bigOrder2M ? orderVol2M : orderVol1M;
                    let orderPx = Number(v.order.limitPx);
                    let orderSz = (orderVol / orderPx).toFixed(2);
                    let price = orderPx.toFixed(5);

                    if (v.order.side === 'buy') {
                        await hlsdk.exchange.placeOrder({
                            coin: v.order.coin,
                            is_buy: true,
                            sz: Number(orderSz),
                            limit_px: Number(price),
                            order_type: { limit: { tif: 'Gtc' } },
                            reduce_only: false
                        }).then(res => {
                            const msg = `${v.order.coin} 跟单买入成功：` + JSON.stringify(res);
                            console.log(msg);
                            sendToWeChat(msg);
                        }).catch(console.error);
                    } else {
                        const myHold = await getPosition(my_address, v.order.coin);
                        if (!myHold) return;
                        const closeSz = Math.abs(Number(myHold.position.szi));

                        await hlsdk.exchange.placeOrder({
                            coin: v.order.coin,
                            is_buy: false,
                            sz: Number(closeSz),
                            limit_px: Number(price),
                            order_type: { limit: { tif: 'Gtc' } },
                            reduce_only: false
                        }).then(res => {
                            const msg = `${v.order.coin} 跟单卖出成功：` + JSON.stringify(res);
                            console.log(msg);
                            sendToWeChat(msg);
                        }).catch(console.error);
                    }
                } catch (err) {
                    console.error('处理订单出错:', err);
                }
            });
        });
    }
}

async function testWs() {
    try {
        sendToWeChat("🚀 hyperliquid 多地址跟单脚本启动！");
        await hlsdk.connect();
        console.log("✅ WebSocket 连接成功，开始监听多个地址...");

        subMultiple(target_addresses);

        hlsdk.ws.on("reconnect", () => {
            console.log("♻️ WebSocket 重连，重新监听所有地址...");
            subMultiple(target_addresses);
        });
    } catch (err) {
        console.error("连接失败:", err);
    }
}

testWs();