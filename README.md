# ThermoGuard AI

## AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data

ThermoGuard AI is a real-time thermal threat intelligence system designed to detect, classify, and prioritize thermal hotspots using satellite-based NASA FIRMS data combined with OpenStreetMap industrial-zone context and historical persistence analysis.

The system converts raw satellite thermal detections into an interactive threat intelligence dashboard.

---

## Problem Statement

Industrial fires and persistent thermal sources can pose serious risks to people, infrastructure, and the environment.

Traditional monitoring systems may not provide a unified view of:

- Current thermal activity
- Thermal intensity
- Industrial proximity
- Repeated thermal activity
- Overall threat priority

ThermoGuard AI addresses this challenge by combining satellite thermal observations with geographic and historical context.

---

## Proposed Solution

ThermoGuard AI processes satellite thermal detections and evaluates them using multiple intelligence signals.

### Core Pipeline

NASA FIRMS Satellite Data  
↓  
Thermal Hotspot Detection  
↓  
Risk Classification  
↓  
Thermal Risk Score  
↓  
Industrial-Zone Context  
↓  
Historical Persistence Analysis  
↓  
Threat Priority Engine  
↓  
Interactive Intelligence Dashboard

---

## Key Features

### 1. NASA FIRMS Thermal Detection

ThermoGuard uses NASA FIRMS satellite observations to identify thermal hotspots.

The system processes:

- Latitude
- Longitude
- Brightness Temperature
- Fire Radiative Power (FRP)
- Confidence
- Satellite
- Acquisition Date
- Acquisition Time

---

### 2. Thermal Risk Classification

Detected hotspots are classified into:

- HIGH
- MEDIUM
- LOW

The classification is based on thermal intensity indicators such as brightness temperature and Fire Radiative Power.

---

### 3. Prototype Thermal Risk Score

ThermoGuard generates a normalized prototype risk score from 0–100 using thermal intensity information.

The score combines:

- Fire Radiative Power
- Brightness Temperature

The current implementation is a rule-based prototype intelligence engine and is not presented as a trained machine-learning model.

---

### 4. Industrial Context

OpenStreetMap industrial-zone information is used to provide geographic context.

The system evaluates whether a detected thermal hotspot is within approximately 5 km of a mapped industrial area.

This provides contextual information for threat prioritization.

Industrial proximity does not by itself prove that an industrial facility caused a thermal detection.

---

### 5. Persistent Thermal Source Detection

Historical NASA FIRMS observations are analyzed across multiple days.

Thermal locations are clustered geographically and checked for repeated detections.

Persistence levels include:

- SINGLE EVENT
- MEDIUM
- HIGH
- VERY HIGH

Repeated detections receive higher persistence significance.

---

### 6. Threat Priority Engine

ThermoGuard combines multiple intelligence signals to prioritize threats.

The system considers:

- Thermal intensity
- Industrial proximity
- Persistent activity

Threat levels include:

- CRITICAL
- HIGH
- MEDIUM
- LOW

The dashboard also explains why a threat was prioritized.

---

### 7. Live Threat Feed

The dashboard provides a live threat feed containing detected thermal events and their associated threat information.

---

### 8. Intelligence Dashboard

The dashboard provides:

- Total Hotspots
- High Risk Hotspots
- Medium Risk Hotspots
- Critical Threats
- Industrial Proximity
- Persistent Sources
- Threat Index
- Mission Status
- Live Threat Feed

---

## Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- Leaflet.js

### Backend

- Python
- Requests
- CSV-based data processing

### Data Sources

- NASA FIRMS
- OpenStreetMap
- Overpass API

### Visualization

- Interactive Leaflet map
- Satellite thermal markers
- Industrial-zone overlays
- Threat indicators
- Intelligence dashboard

---

## Project Structure

```text
ThermoGuard/
│
├── backend/
│   ├── test-firms.py
│   └── persistence.py
│
├── data/
│   ├── firms_history.csv
│   ├── hotspots.csv
│   └── persistence_results.csv
│
├── frontend/
│   ├── index.html
│   └── map.js
│
└── README.md