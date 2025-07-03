import { Hyperliquid } from "./dist/index.js";;



const private_key = "0x560ef5362577de1f96ce462b3adb5747d0ca433d035f4f73b434d010baf9f586";
const my_address = "0x3D9df980B3AE251A9B719c4c3fE6aCb84bd3B93C";

//cqy test
// const user_address = "0x8C2a1daEc7c7Cd8C9047aC82f699A499d5849C71"

// const user_address = "0x644f7170fae9d4d173d9217f03b7a77e22ed98f1"
const testnet = false// false for mainnet, true for testnet
const vaultAddress = null // or your vault address


async function testWebSocket(): Promise<void> {
    // Create a new Hyperliquid instance
    // You can pass a privateKey in the options if you need authenticated access
    const sdk = new Hyperliquid({
        privateKey: private_key,
        testnet: testnet,
        walletAddress: my_address,
        enableWs: true,
        // vaultAddress: vaultAddress,
        maxReconnectAttempts: 100
    });

    try {
        // Connect to the WebSocket
        await sdk.connect();
        console.log('Connected to WebSocket');

        // Subscribe to get latest prices for all coins
        sdk.subscriptions.subscribeToAllMids((data: Record<string, string>) => {
            console.log('Received trades data:', data);
        });

        // Get updates anytime the user gets new fills
        sdk.subscriptions.subscribeToUserFills("<wallet_address_here>", (data: any) => {
            console.log('Received user fills data:', data);
        });

        // Get updates on 1 minute BTC-PERP candles
        sdk.subscriptions.subscribeToCandle("BTC-PERP", "1m", (data: any) => {
            console.log('Received candle data:', data);
        });

        // Keep the script running
        await new Promise<void>(() => {});
    } catch (error) {
        console.error('Error:', error);
    }
}

testWebSocket();