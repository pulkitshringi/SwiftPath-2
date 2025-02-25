import React from "react";
import { Card, CardContent, Typography, Box } from "@mui/material";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";

const DashboardHeader = () => {
  return (
    <Box sx={{ width: "100%", m: 0, p: 0 }}> {/* ✅ Ensures full width, removes margins */}
      <Card
        sx={{
          backgroundColor: "#1976d2",
          color: "white",
          textAlign: "center",
          borderRadius: 0, // ✅ Removes rounded corners
          boxShadow: 0, // ✅ Removes shadow for flush layout
        }}
      >
        <CardContent sx={{ p: 1 }}> {/* ✅ Reduces padding */}
          <LocalHospitalIcon sx={{ fontSize: 35, mb: -0.5 }} />
          <Typography variant="h5" sx={{ mt: 0 }}>
            🚑 Ambulance Dispatch Dashboard
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardHeader;