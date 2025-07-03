import axios from 'axios';

export async function sendToWeChat(message: string) {
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