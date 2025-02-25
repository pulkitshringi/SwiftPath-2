// // components/Sidebar.js
// import React, { useState } from "react";
// import { Box, Button, TextField, Typography } from "@mui/material";

// const Sidebar = ({ onFetchRoute }) => {
//   const [origin, setOrigin] = useState("");
//   const [destination, setDestination] = useState("");

//   return (
//     <Box p={2} sx={{ width: 300, background: "#fff", height: "100vh", boxShadow: 3 }}>
//       <Typography variant="h6">Enter Locations</Typography>

//       <TextField
//         label="Origin"
//         fullWidth
//         value={origin}
//         onChange={(e) => setOrigin(e.target.value)}
//         sx={{ my: 1 }}
//       />
      
//       <TextField
//         label="Destination"
//         fullWidth
//         value={destination}
//         onChange={(e) => setDestination(e.target.value)}
//         sx={{ my: 1 }}
//       />

//       <Button
//         variant="contained"
//         color="primary"
//         fullWidth
//         sx={{ mt: 2 }}
//         onClick={() => onFetchRoute(origin, destination)}
//       >
//         Show Route
//       </Button>
//     </Box>
//   );
// };

// export default Sidebar;