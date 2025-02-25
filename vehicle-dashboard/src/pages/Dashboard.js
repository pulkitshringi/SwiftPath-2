// pages/Dashboard.js
import React, { useState } from "react";
import { Box } from "@mui/material";
import Sidebar from "../components/Sidebar";
import VehicleMap from "../components/VehicleMap";
import DashboardCards from "../components/DashboardCards";

const Dashboard = () => {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const handleFetchRoute = (newOrigin, newDestination) => {
    setOrigin(newOrigin);
    setDestination(newDestination);
  };

  return (
    <Box display="flex">
      {/* <Sidebar onFetchRoute={handleFetchRoute} /> */}
      <Box flex={1}>
        <DashboardCards />
        <VehicleMap origin={origin} destination={destination} />
      </Box>
    </Box>
  );
};

export default Dashboard;