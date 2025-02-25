import React, { useState, useEffect } from "react";
import { GoogleMap, LoadScript, DirectionsRenderer, Marker } from "@react-google-maps/api";
import "bootstrap/dist/css/bootstrap.min.css";
import osmTrafficLights from "../data/TrafficLights.json";

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
  const [allTrafficLightMarkers, setAllTrafficLightMarkers] = useState([]);

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  // Load all traffic lights initially when the map loads
  useEffect(() => {
    if (mapLoaded) {
      // Extract all traffic lights from the JSON data
      const allLights = osmTrafficLights.elements
        .filter(element => element.tags && element.tags.highway === "traffic_signals")
        .map(element => ({
          lat: element.lat,
          lng: element.lon
        }));
      
      setAllTrafficLightMarkers(allLights);
    }
  }, [mapLoaded]);

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
  
            // Get route bounds
            const bounds = new window.google.maps.LatLngBounds();
            result.routes[0].overview_path.forEach((point) => {
              bounds.extend(point);
            });
            
            // Find traffic lights along the route
            // Filter traffic lights that are within the route bounds
            const trafficLightElements = osmTrafficLights.elements.filter((element) => {
              if (element.tags && element.tags.highway === "traffic_signals") {
                const position = {
                  lat: element.lat,
                  lng: element.lon
                };
                
                // More precise filtering to ensure lights are close to the route
                let isOnRoute = false;
                const trafficLightPosition = new window.google.maps.LatLng(position.lat, position.lng);
                
                // Check if the traffic light is close to any part of the path
                for (let i = 0; i < result.routes[0].overview_path.length - 1; i++) {
                  const pathSegStart = result.routes[0].overview_path[i];
                  const pathSegEnd = result.routes[0].overview_path[i + 1];
                  
                  // Calculate distance from point to line segment
                  const distanceToSegment = distanceToLineSegment(
                    pathSegStart.lat(), pathSegStart.lng(),
                    pathSegEnd.lat(), pathSegEnd.lng(),
                    position.lat, position.lng
                  );
                  
                  // If the traffic light is within ~50 meters of the route path
                  if (distanceToSegment < 0.0005) {
                    isOnRoute = true;
                    break;
                  }
                }
                
                return isOnRoute;
              }
              return false;
            });

            // Create markers for each traffic light on the route
            const markers = trafficLightElements.map((element) => ({
              lat: element.lat,
              lng: element.lon
            }));

            setTrafficLightMarkers(markers);
            setTrafficLights(markers.length);
  
            // Create a smooth route using the decoded polyline for each step.
            let routePath = [];
            leg.steps.forEach((step) => {
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
  // Helper function to calculate distance from a point to a line segment
const distanceToLineSegment = (x1, y1, x2, y2, px, py) => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  
  if (len_sq !== 0) param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  
  // Return the distance
  return Math.sqrt(dx * dx + dy * dy);
};

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
                
                {/* Display traffic light markers based on request status */}
                {requestAccepted ? (
                  // When request is accepted, show only traffic lights on the route
                  trafficLightMarkers.map((marker, index) => (
                    <Marker
                      key={`route-traffic-light-${index}`}
                      position={marker}
                      icon={{
                        url: "https://img.icons8.com/color/48/000000/traffic-light.png",
                        scaledSize: new window.google.maps.Size(30, 30),
                      }}
                    />
                  ))
                ) : (
                  // Before request is accepted, show all traffic lights
                  allTrafficLightMarkers.map((marker, index) => (
                    <Marker
                      key={`all-traffic-light-${index}`}
                      position={marker}
                      icon={{
                        url: "https://img.icons8.com/color/48/000000/traffic-light.png",
                        scaledSize: new window.google.maps.Size(30, 30),
                      }}
                    />
                  ))
                )}
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