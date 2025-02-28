// server.js
require("dotenv").config();
const WebSocket = require("ws");
const twilio = require("twilio");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Load Twilio credentials from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const adminNumber = "+916375195644"; // Replace with your number

const client = twilio(accountSid, authToken);

const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients to track vehicle dashboards
const connectedClients = new Set();

wss.on("connection", (ws) => {
  console.log("✅ New client connected");
  connectedClients.add(ws);

  // Send initial data if needed
  // Example: sendTrafficLightUpdates(ws);

  ws.on("message", async (message) => {
    console.log("📩 Received:", message);
    
    try {
      const data = JSON.parse(message);
      
      // Handle different incoming message types
      if (data.messageType === "emergencyRequest") {
        // Handle emergency request
        await handleEmergencyRequest(data, ws);
      } 
      else if (data.messageType === "vehicleLocationUpdate") {
        // Handle vehicle location update
        broadcastCoordinateUpdate(data);
      }
      else {
        // Legacy support for messages without messageType
        if (data.name) {
          await handleEmergencyRequest(data, ws);
        } else {
          console.log("Unknown message format received:", data);
        }
      }
    } catch (error) {
      console.error("❌ Error processing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
    connectedClients.delete(ws);
  });
});

console.log("🚀 WebSocket Server running on ws://localhost:8080");

// 🔹 Function to handle emergency requests
async function handleEmergencyRequest(data, senderWs) {
  const { name, nearbyTrafficLights, latitude, longitude, direction, fromDirection } = data;
  
  // Ensure the data has the required fields
  if (!name) {
    console.error("❌ Error: Missing patient name in emergency request");
    return;
  }

  // Send SMS notification
  console.log(`📲 Sending SMS to ${adminNumber} for patient ${name}...`);
  sendSMS(adminNumber, name);

  // Store traffic light data in Firestore if available
  if (nearbyTrafficLights && Array.isArray(nearbyTrafficLights)) {
    try {
      const batch = db.batch();
      nearbyTrafficLights.forEach((trafficLight) => {
        const trafficLightRef = db.collection("traffic_lights").doc();
        batch.set(trafficLightRef, {
          latitude: trafficLight.lat,
          longitude: trafficLight.lng,
          direction: trafficLight.direction, // "to" direction
          fromDirection: trafficLight.fromDirection || data.fromDirection, // Add "from" direction
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      console.log("✅ Traffic light data stored in Firestore");
    } catch (error) {
      console.error("❌ Error storing traffic light data:", error);
    }
  }

  // Format the message with the correct messageType for broadcasting
  const emergencyMessage = JSON.stringify({
    messageType: "emergencyRequest",
    name: name,
    latitude: latitude || data.lat,
    longitude: longitude || data.lng,
    direction: direction, // "to" direction
    fromDirection: fromDirection, // Include "from" direction
    timestamp: new Date().toISOString(),
    // Include any other relevant fields
    ...data
  });
  // Broadcast to all connected clients except the sender
  broadcastMessage(emergencyMessage, senderWs);
}

// 🔹 Function to broadcast coordinate updates
function broadcastCoordinateUpdate(data) {
  // Format the message with the correct messageType
  const coordinateMessage = JSON.stringify({
    messageType: "coordinateUpdate",
    latitude: data.latitude || data.lat,
    longitude: data.longitude || data.lng,
    vehicleId: data.vehicleId,
    direction: data.direction, // "to" direction
    fromDirection: data.fromDirection, // Include "from" direction
    timestamp: new Date().toISOString()
  });

  // Broadcast to all connected clients
  broadcastMessage(coordinateMessage);
}

// 🔹 Function to broadcast traffic light updates
function broadcastTrafficLightUpdate(trafficLightData) {
  // Format the message with the correct messageType
  const trafficLightMessage = JSON.stringify({
    messageType: "trafficLightUpdate",
    trafficLights: trafficLightData,
    timestamp: new Date().toISOString()
  });

  // Broadcast to all connected clients
  broadcastMessage(trafficLightMessage);
}

// 🔹 Generic function to broadcast messages to all clients
function broadcastMessage(message, excludeWs = null) {
  connectedClients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 🔹 Function to Send SMS
const sendSMS = (recipientNumber, patientName) => {
  console.log(`📡 Sending SMS: "🚑 ALERT: Ambulance dispatched for ${patientName}." to ${recipientNumber}`);

  client.messages
    .create({
      body: `🚑 ALERT: Ambulance dispatched for ${patientName}. Stay safe!`,
      from: twilioNumber,
      to: recipientNumber,
    })
    .then((message) => console.log(`✅ SMS sent successfully: ${message.sid}`))
    .catch((error) => console.error(`❌ Failed to send SMS:`, error));
};

// Optional: Function to periodically update traffic light status from database
// This could be called on a timer to push updates to all clients
async function sendTrafficLightUpdates() {
  try {
    // Fetch latest traffic light data from Firestore
    const snapshot = await db.collection("traffic_lights")
      .orderBy("timestamp", "desc")
      .limit(20)
      .get();
    
    if (!snapshot.empty) {
      const trafficLights = [];
      snapshot.forEach(doc => {
        trafficLights.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate().toISOString()
        });
      });
      
      // Broadcast traffic light updates to all clients
      broadcastTrafficLightUpdate(trafficLights);
    }
  } catch (error) {
    console.error("❌ Error fetching traffic light data:", error);
  }
}