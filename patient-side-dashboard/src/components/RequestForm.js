import React, { useState } from "react";
import "../styles.css";

const ws = new WebSocket("ws://localhost:8080"); // Connect to WebSocket server

const RequestForm = () => {
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const sendRequest = () => {
    if (!patientName || !phone) {
      alert("❗ Please enter your name and phone number.");
      return;
    }

    setLoading(true);

    // Get GPS location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const data = {
          name: patientName,
          phone: phone,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
        };

        // Send data to WebSocket
        ws.send(JSON.stringify(data));

        setIsSent(true);
        setLoading(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("⚠ Location access is required!");
        setLoading(false);
      }
    );
  };

  return (
    <div className="container">
      <div className="form-box">
        <h2>🚑 Request an Ambulance</h2>

        <input
          type="text"
          placeholder="Enter Patient's Name"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          className="input-field"
        />

        <input
          type="tel"
          placeholder="Enter Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input-field"
        />

        <button
          onClick={sendRequest}
          className={`submit-btn ${loading ? "disabled" : ""}`}
          disabled={loading}
        >
          {loading ? "Sending..." : "🚨 Request Ambulance"}
        </button>

        {isSent && <p className="success-message">✅ Request Sent! Ambulance is on the way.</p>}
      </div>
    </div>
  );
};

export default RequestForm;