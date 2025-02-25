require("dotenv").config();
const WebSocket = require("ws");
const twilio = require("twilio");

// Load Twilio credentials from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const adminNumber = "+916375195644"; // Your fixed number

const client = twilio(accountSid, authToken);

const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
    console.log("✅ New client connected");

    ws.on("message", (message) => {
        console.log("📩 Received:", message);

        // Parse patient data
        const data = JSON.parse(message);
        const { name } = data;

        if (name) {
            console.log(`📲 Sending SMS to ${adminNumber} for patient ${name}...`);
            sendSMS(adminNumber, name);
        } else {
            console.error("❌ Error: Missing patient name.");
        }

        // 🔹 Broadcast the request to all connected vehicle dashboards
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on("close", () => console.log("❌ Client disconnected"));
});

console.log("🚀 WebSocket Server running on ws://localhost:8080");

// 🔹 Function to Send SMS
const sendSMS = (recipientNumber, patientName) => {
    console.log(`📡 Sending SMS: "🚑 ALERT: Ambulance dispatched for ${patientName}." to ${recipientNumber}`);

    client.messages
        .create({
            body: `🚑 ALERT: Ambulance dispatched for ${patientName}. Stay safe!`,
            from: twilioNumber, // Loaded from .env
            to: recipientNumber,
        })
        .then(message => console.log(`✅ SMS sent successfully: ${message.sid}`))
        .catch(error => console.error(`❌ Failed to send SMS:`, error));
};