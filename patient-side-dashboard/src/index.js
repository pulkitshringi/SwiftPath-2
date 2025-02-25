import React from "react";
import ReactDOM from "react-dom/client";  // ✅ Correct import for React 18
import "./styles.css";
import App from "./App";

// ✅ React 18+ way to render
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);