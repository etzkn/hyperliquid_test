const { Hyperliquid } = require("../dist/index.js");
const axios = require('axios');

const bigOrder1M = 0;
const bigOrder2M = 1000000;

const orderVol1M = 12;
const orderVol2M = 12;

const leverage1 = 0;

const private_key = "d9e4fbc076335ed753da8651722d7799a20deeca46b0d4b1a0e032a82305642f";
const my_address = "0x2948E31Ce2034845E4Ea20C7a076d71E8694317D";
const target_address = "0x8747A002FfCD1B42720154C716578FA0989B5c74";

const testnet = false;
const vaultAddress = null;

const hlsdk = new Hyperliquid({
    privateKey: private_key,
    testnet: testnet,
    walletAddress: my_address,
    vaultAddress: vaultAddress,
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

function subSingle(target) {
    const startTimestamp = Date.now();
    console.log("开始监听地址:", target);

    hlsdk.subscriptions.subscribeToOrderUpdates(target, data => {
        data.map(async v => {
            console.log("🟢 收到订单：", v);
            try {
                if (v.statusTimestamp < startTimestamp) return;
                if (v.status !== 'filled') return;
                if (!v.order.coin.includes('-PERP')) return;

                const vol = Number(v.order.limitPx) * Number(v.order.origSz);
                if (vol < bigOrder1M) return;

                const hold = await getPosition(target, v.order.coin);
                if (hold && hold.position.maxLeverage < leverage1) return;

                console.log('符合下单条件:', v);

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

async function testWs() {
    try {
        sendToWeChat("🚀 hyperliquid copy trade run");
        await hlsdk.connect();
        console.log("✅ WebSocket 连接成功，开始监听跟单地址...");

        subSingle(target_address);

        hlsdk.ws.on("reconnect", () => {
            console.log("♻️ WebSocket 重连，重新监听...");
            subSingle(target_address);
        });
    } catch (err) {
        console.error("连接失败:", err);
    }
}

testWs();