import React, { useState, useEffect } from "react";
import { GoogleMap, LoadScript, DirectionsRenderer, Marker } from "@react-google-maps/api";
import "bootstrap/dist/css/bootstrap.min.css";

const containerStyle = { width: "100%", height: "100vh" };
const center = { lat: 13.0827, lng: 80.2707 }; // Default Chennai center
const ws = new WebSocket("ws://localhost:8080");

const VehicleMap = () => {
  const [directions, setDirections] = useState(null);
  const [ambulancePosition, setAmbulancePosition] = useState({ lat: 13.0827, lng: 80.2707 });
  const [patientLocation, setPatientLocation] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [emergencyData, setEmergencyData] = useState(null);
  const [eta, setEta] = useState(null);
  const [trafficLights, setTrafficLights] = useState(0);
  const [trafficLightMarkers, setTrafficLightMarkers] = useState([]);
  const [requestPending, setRequestPending] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("New patient request received:", data);
      setEmergencyData(data);
      setPatientLocation({ lat: data.latitude, lng: data.longitude });
      setRequestPending(true);
    };
  }, []);

  useEffect(() => {
    if (!patientLocation || !mapLoaded || !requestAccepted) return;
  
    const fetchRoute = async () => {
      if (!window.google || !window.google.maps) {
        console.error("Google Maps API not loaded yet.");
        return;
      }
  
      const directionsService = new window.google.maps.DirectionsService();
  
      directionsService.route(
        {
          origin: ambulancePosition,
          destination: patientLocation,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirections(result);
  
            // Get ETA
            const leg = result.routes[0].legs[0];
            setEta(leg.duration.text);
  
            // Count intersections as a proxy for traffic lights and gather their positions
            const steps = leg.steps;
            let intersectionCount = 0;
            let intersectionMarkers = [];
  
            steps.forEach((step) => {
              // Use step.start_location as the marker position
              const markerPosition = {
                lat: step.start_location.lat(),
                lng: step.start_location.lng(),
              };
  
              if (step.maneuver) {
                intersectionCount++;
                intersectionMarkers.push(markerPosition);
              } else if (step.html_instructions) {
                // Look for "continue" and a short step distance (e.g., <100m)
                const instruction = step.html_instructions.toLowerCase();
                if (instruction.includes("continue") && step.distance.value < 100) {
                  intersectionCount++;
                  intersectionMarkers.push(markerPosition);
                }
              }
            });
  
            setTrafficLights(intersectionCount);
            setTrafficLightMarkers(intersectionMarkers);
  
            // Create a smooth route using the decoded polyline for each step.
            let routePath = [];
            steps.forEach((step) => {
              if (step.polyline?.points) {
                // Decode the encoded polyline string using the geometry library
                const decodedPoints = window.google.maps.geometry.encoding.decodePath(step.polyline.points);
                decodedPoints.forEach((point) => {
                  routePath.push({ lat: point.lat(), lng: point.lng() });
                });
              }
            });
  
            moveAmbulanceSmoothly(routePath);
          } else {
            console.error("Error fetching directions:", status);
          }
        }
      );
    };
  
    fetchRoute();
  }, [patientLocation, mapLoaded, requestAccepted]);
  
  // Function to move ambulance smoothly along the route.
  const moveAmbulanceSmoothly = (routePath) => {
    let index = 0;
  
    const moveStep = () => {
      if (index < routePath.length - 1) {
        const start = routePath[index];
        const end = routePath[index + 1];
  
        const distance = Math.sqrt(
          Math.pow(end.lat - start.lat, 2) + Math.pow(end.lng - start.lng, 2)
        );
  
        const speedFactor = 0.0001; // Adjust for smoother movement
        const totalSteps = Math.max(10, Math.round(distance / speedFactor));
  
        let step = 0;
  
        const interval = setInterval(() => {
          if (step < totalSteps) {
            const lat = start.lat + ((end.lat - start.lat) * step) / totalSteps;
            const lng = start.lng + ((end.lng - start.lng) * step) / totalSteps;
            setAmbulancePosition({ lat, lng });
            step++;
          } else {
            clearInterval(interval);
            index++;
            moveStep();
          }
        }, 50); // Controls overall speed (lower = faster)
      }
    };
  
    moveStep();
  };
  

  const handleAcceptRequest = async () => {
    setRequestPending(false);
    setRequestAccepted(true);

    if (emergencyData?.name) {
      try {
        await fetch("http://localhost:8080/accept-request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ patientName: emergencyData.name }),
        });
        console.log("✅ Request accepted & SMS triggered!");
      } catch (error) {
        console.error("❌ Error sending request:", error);
      }
    }
  };

  const handleRejectRequest = () => {
    setRequestPending(false);
    setEmergencyData(null);
    setPatientLocation(null);
  };

  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      libraries={["geometry"]}
      onLoad={() => setMapLoaded(true)}
    >
      <div className="container-fluid">
        <div className="row">
          {/* Left Panel - Accept/Reject Request */}
          <div className="col-md-3 bg-light p-3">
            {requestPending ? (
              <div className="card">
                <div className="card-header bg-danger text-white">🚨 Emergency Request</div>
                <div className="card-body">
                  <p><strong>Patient:</strong> {emergencyData?.name}</p>
                  <p><strong>Phone:</strong> {emergencyData?.phone}</p>
                  <p><strong>Location:</strong> {patientLocation?.lat}, {patientLocation?.lng}</p>
                  <button className="btn btn-success w-100 mb-2" onClick={handleAcceptRequest}>✅ Accept</button>
                  <button className="btn btn-danger w-100" onClick={handleRejectRequest}>❌ Reject</button>
                </div>
              </div>
            ) : requestAccepted ? (
              <div className="card">
                <div className="card-header bg-primary text-white">🚑 Ambulance on the Way</div>
                <div className="card-body">
                  <p><strong>ETA:</strong> {eta ? eta : "Calculating..."}</p>
                  <p><strong>Traffic Lights on Route:</strong> {trafficLights} 🚦</p>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-header bg-secondary text-white">⏳ Waiting for Request</div>
                <div className="card-body">
                  <p>No emergency request received yet.</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Map */}
          <div className="col-md-9">
            {mapLoaded ? (
              <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={12}>
                {directions && <DirectionsRenderer directions={directions} />}
                {ambulancePosition && (
                  <Marker
                    position={ambulancePosition}
                    icon={{
                      url: "https://cdn-icons-png.flaticon.com/512/2894/2894975.png",
                      scaledSize: new window.google.maps.Size(50, 50),
                    }}
                  />
                )}
                {patientLocation && (
                  <Marker
                    position={patientLocation}
                    icon={{
                      url: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
                      scaledSize: new window.google.maps.Size(40, 40),
                    }}
                  />
                )}
                {trafficLightMarkers.map((marker, index) => (
                  <Marker
                    key={`traffic-light-${index}`}
                    position={marker}
                    icon={{
                      url: "https://img.icons8.com/color/48/000000/traffic-light.png",
                      scaledSize: new window.google.maps.Size(30, 30),
                    }}
                  />
                ))}
              </GoogleMap>
            ) : (
              <p>Loading Google Maps...</p>
            )}
          </div>
        </div>
      </div>
    </LoadScript>
  );
};

export default VehicleMap;