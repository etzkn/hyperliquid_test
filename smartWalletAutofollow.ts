import mysql from 'mysql2/promise';
import { Hyperliquid } from './dist/index.js';

// 数据库连接配置
const dbConfig = {
    host: '34.46.218.219',
    port: 9030,
    user: 'transaction',
    password: 'trans_dskke33@72hxcys',
    database: 'hiper_trade_data',
    connectionLimit: 10,
};

const pool = mysql.createPool(dbConfig);

// Hyperliquid 配置
const private_key = "d9e4fbc076335ed753da8651722d7799a20deeca46b0d4b1a0e032a82305642f";
const my_address = "0x2948E31Ce2034845E4Ea20C7a076d71E8694317D";
const testnet = false;

const sdk = new Hyperliquid({
    privateKey: private_key,
    testnet: testnet,
    walletAddress: my_address,
    enableWs: true,
});

// 订单结构定义
interface Order {
    user_address: string;
    token: string;
    direction: string;
    size: number;
    price: number;
}

// 查询聪明钱包地址
async function getSmartWalletAddresses(): Promise<string[]> {
    const [rows] = await pool.query("SELECT wallet_address FROM wallets WHERE smart_wallet = true");
    return (rows as { wallet_address: string }[]).map(row => row.wallet_address);
}

// 查询大额订单
async function getBigOrders(wallet: string, minSize: number = 10): Promise<Order[]> {
    const [rows] = await pool.query(
        `SELECT buyer AS user_address, token, 
                CASE side WHEN 'A' THEN 'buy' ELSE 'sell' END AS direction, 
                size, price 
         FROM total_transaction 
         WHERE buyer = ? AND size >= ?`,
        [wallet, minSize]
    );
    return rows as Order[];
}


// 自动下单
async function placeOrderFromSignal(order: Order): Promise<void> {
    const is_buy = order.direction.toLowerCase() === "buy"; // 数据库中是 "A"（买单）或 "B"（卖单），你可以根据字段内容自行调整

    try {
        const res = await sdk.exchange.placeOrder({
            coin: order.token,
            is_buy,
            sz: Number(order.size),
            limit_px: Number(order.price),
            order_type: { limit: { tif: 'Gtc' } },
            reduce_only: false,
        });
        console.log(`✅ Order placed for ${order.token} from ${order.user_address.slice(0, 10)}...`);
    } catch (err) {
        console.error('❌ Error placing order:', err);
    }
}

// 主函数
async function main(): Promise<void> {
    console.log("🚀 开始扫描聪明钱包的大额开仓订单...");
    try {
        const addresses = await getSmartWalletAddresses();
        console.log(`找到 ${addresses.length} 个聪明钱包`);

        for (const addr of addresses) {
            const orders = await getBigOrders(addr);
            console.log(`钱包 ${addr} 有 ${orders.length} 个符合条件的大额订单`);
            for (const order of orders) {
                await placeOrderFromSignal(order);
            }
        }
    } catch (err) {
        console.error("❌ 程序执行出错:", err);
    }
}

main();