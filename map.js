// ============================================================
// THERMOGUARD AI — INTELLIGENCE MAP
// Complete corrected version
// ============================================================


// ============================================================
// MAP INITIALIZATION
// ============================================================

const thermoguardMap = L.map("map", {
    zoomControl: false
}).setView([17.45, 78.38], 9);


// ============================================================
// DARK ESRI BASEMAP
// ============================================================

L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Tiles &copy; Esri",
        maxZoom: 16
    }
).addTo(thermoguardMap);


// ============================================================
// ZOOM CONTROL
// ============================================================

L.control.zoom({
    position: "bottomright"
}).addTo(thermoguardMap);


// ============================================================
// INTELLIGENCE LAYERS
// ============================================================

const industrialLayer =
    L.layerGroup().addTo(thermoguardMap);

const persistenceLayer =
    L.layerGroup().addTo(thermoguardMap);


// ============================================================
// GLOBAL DATA
// ============================================================

let hotspotData = [];
let industrialAreas = [];
let persistenceData = [];

let industrialContextReady = false;
let industrialContextUnavailable = false;


// ============================================================
// OVERPASS SERVERS
// Multiple public mirrors are used so one 429 does not
// break the entire industrial intelligence system.
// ============================================================

const OVERPASS_SERVERS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter"
];


// ============================================================
// INDUSTRIAL SEARCH AREA
// Telangana + Andhra Pradesh + surrounding region
// ============================================================

const INDUSTRIAL_QUERY = `
[out:json][timeout:45];
(
    way["landuse"="industrial"](13.5,77.5,18.5,81.0);
    relation["landuse"="industrial"](13.5,77.5,18.5,81.0);
);
out geom;
`;


// ============================================================
// GENERIC FETCH WITH TIMEOUT
// ============================================================

async function fetchWithTimeout(
    url,
    options = {},
    timeout = 45000
) {

    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(
            () => controller.abort(),
            timeout
        );

    try {

        const response =
            await fetch(
                url,
                {
                    ...options,
                    signal:
                        controller.signal
                }
            );

        return response;

    }

    finally {

        clearTimeout(timeoutId);

    }

}


// ============================================================
// LOAD INDUSTRIAL CONTEXT
// ============================================================

async function loadIndustrialContext() {

    console.log(
        "ThermoGuard AI — Loading industrial context..."
    );

    let lastError = null;

    for (
        let i = 0;
        i < OVERPASS_SERVERS.length;
        i++
    ) {

        const server =
            OVERPASS_SERVERS[i];

        try {

            console.log(
                `Industrial context server ${i + 1}/${OVERPASS_SERVERS.length}`
            );

            const response =
                await fetchWithTimeout(
                    server,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded"
                        },

                        body:
                            "data=" +
                            encodeURIComponent(
                                INDUSTRIAL_QUERY
                            )
                    },
                    45000
                );


            // ------------------------------------------------
            // RATE LIMIT
            // ------------------------------------------------

            if (response.status === 429) {

                console.warn(
                    `Overpass server ${i + 1} returned 429. Trying next server...`
                );

                continue;

            }


            // ------------------------------------------------
            // OTHER HTTP ERROR
            // ------------------------------------------------

            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }


            // ------------------------------------------------
            // READ JSON
            // ------------------------------------------------

            const data =
                await response.json();


            if (
                !data ||
                !Array.isArray(data.elements)
            ) {

                throw new Error(
                    "Invalid Overpass response"
                );

            }


            // ------------------------------------------------
            // SUCCESS
            // ------------------------------------------------

            industrialAreas =
                data.elements;

            industrialContextReady = true;
            industrialContextUnavailable = false;

            console.log(
                `Industrial areas found: ${industrialAreas.length}`
            );

            console.log(
                "ThermoGuard AI — Industrial context online."
            );


            // ------------------------------------------------
            // DRAW INDUSTRIAL AREAS
            // ------------------------------------------------

            drawIndustrialAreas();


            // ------------------------------------------------
            // RUN PROXIMITY ANALYSIS
            // ------------------------------------------------

            analyzeIndustrialProximity();


            return;

        }

        catch (error) {

            lastError = error;

            if (
                error.name ===
                "AbortError"
            ) {

                console.warn(
                    `Overpass server ${i + 1} timed out. Trying next server...`
                );

            }

            else {

                console.warn(
                    `Overpass server ${i + 1} unavailable. Trying next server...`
                );

            }

        }

    }


    // ========================================================
    // ALL SERVERS FAILED
    // ========================================================

    industrialAreas = [];

    industrialContextReady = false;
    industrialContextUnavailable = true;

    console.warn(
        "Industrial context temporarily unavailable. ThermoGuard will continue without live OSM industrial polygons."
    );


    if (lastError) {

        console.warn(
            "Industrial context fallback:",
            lastError.message
        );

    }


    // Still run the intelligence engine.
    analyzeIndustrialProximity();

}


// ============================================================
// DRAW INDUSTRIAL POLYGONS
// ============================================================

function drawIndustrialAreas() {

    industrialLayer.clearLayers();


    industrialAreas.forEach(
        area => {

            if (
                !area.geometry ||
                !area.geometry.length
            ) {

                return;

            }


            const coordinates =
                area.geometry.map(
                    point => [
                        point.lat,
                        point.lon
                    ]
                );


            if (
                coordinates.length < 3
            ) {

                return;

            }


            L.polygon(
                coordinates,
                {
                    color: "#38bdf8",

                    weight: 1,

                    opacity: 0.55,

                    fillColor: "#38bdf8",

                    fillOpacity: 0.08
                }
            )
            .bindTooltip(
                "OSM INDUSTRIAL ZONE",
                {
                    sticky: true
                }
            )
            .addTo(industrialLayer);

        }
    );


    console.log(
        "ThermoGuard AI — Industrial layer rendered."
    );

}


// ============================================================
// DISTANCE BETWEEN TWO GPS POINTS
// ============================================================

function distanceInMeters(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const dLat =
        (
            (lat2 - lat1) *
            Math.PI
        ) / 180;

    const dLon =
        (
            (lon2 - lon1) *
            Math.PI
        ) / 180;


    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(
            lat1 * Math.PI / 180
        ) *
        Math.cos(
            lat2 * Math.PI / 180
        ) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;

}


// ============================================================
// DISTANCE FROM HOTSPOT TO INDUSTRIAL POLYGON BOUNDS
// ============================================================

function distanceToIndustrialArea(
    latitude,
    longitude,
    area
) {

    if (
        !area.geometry ||
        !area.geometry.length
    ) {

        return Infinity;

    }


    let minimumDistance =
        Infinity;


    // --------------------------------------------------------
    // First check every polygon point.
    // --------------------------------------------------------

    area.geometry.forEach(
        point => {

            const distance =
                distanceInMeters(
                    latitude,
                    longitude,
                    point.lat,
                    point.lon
                );

            if (
                distance <
                minimumDistance
            ) {

                minimumDistance =
                    distance;

            }

        }
    );


    // --------------------------------------------------------
    // Calculate polygon bounds.
    // --------------------------------------------------------

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;


    area.geometry.forEach(
        point => {

            minLat =
                Math.min(
                    minLat,
                    point.lat
                );

            maxLat =
                Math.max(
                    maxLat,
                    point.lat
                );

            minLon =
                Math.min(
                    minLon,
                    point.lon
                );

            maxLon =
                Math.max(
                    maxLon,
                    point.lon
                );

        }
    );


    // --------------------------------------------------------
    // If point is inside bounds, distance is zero.
    // --------------------------------------------------------

    if (
        latitude >= minLat &&
        latitude <= maxLat &&
        longitude >= minLon &&
        longitude <= maxLon
    ) {

        return 0;

    }


    // --------------------------------------------------------
    // Nearest point on bounding rectangle.
    // --------------------------------------------------------

    const nearestLat =
        Math.max(
            minLat,
            Math.min(
                maxLat,
                latitude
            )
        );

    const nearestLon =
        Math.max(
            minLon,
            Math.min(
                maxLon,
                longitude
            )
        );


    const boundsDistance =
        distanceInMeters(
            latitude,
            longitude,
            nearestLat,
            nearestLon
        );


    return Math.min(
        minimumDistance,
        boundsDistance
    );

}


// ============================================================
// BUILD PROFESSIONAL HOTSPOT POPUP
// ============================================================

function buildHotspotPopup(
    hotspot
) {

    const riskColor =
        hotspot.risk === "HIGH"
            ? "#ff3b30"
            : hotspot.risk === "MEDIUM"
                ? "#ff9500"
                : "#34c759";


    // --------------------------------------------------------
    // INDUSTRIAL CONTEXT
    // --------------------------------------------------------

    let industrialStatus =
        "No nearby industrial zone";

    let industrialColor =
        "#94a3b8";


    if (
        industrialContextUnavailable
    ) {

        industrialStatus =
            "Industrial context unavailable";

        industrialColor =
            "#64748b";

    }

    else if (
        hotspot.industrialProximity
    ) {

        industrialStatus =
            `Industrial zone within 5 km`;

        industrialColor =
            "#38bdf8";

    }


    // --------------------------------------------------------
    // INDUSTRIAL DISTANCE
    // --------------------------------------------------------

    let industrialDistanceText =
        "N/A";


    if (
        hotspot.nearestIndustrialDistance !==
        Infinity
    ) {

        industrialDistanceText =
            (
                hotspot.nearestIndustrialDistance /
                1000
            ).toFixed(2) +
            " km";

    }


    // --------------------------------------------------------
    // PERSISTENCE
    // --------------------------------------------------------

    let persistenceStatus =
        "No persistent source linked";

    let persistenceColor =
        "#64748b";


    if (
        hotspot.persistenceDetected
    ) {

        persistenceColor =
            hotspot.persistenceLevel ===
            "VERY HIGH"

                ? "#ff3b30"

                : hotspot.persistenceLevel ===
                  "HIGH"

                    ? "#ff9500"

                    : "#ffd60a";


        persistenceStatus =
            `${hotspot.persistenceLevel} • ` +
            `${hotspot.persistenceDays} DAY` +
            (
                hotspot.persistenceDays > 1
                    ? "S"
                    : ""
            );

    }


    // --------------------------------------------------------
    // WHY THREAT WAS PRIORITIZED
    // --------------------------------------------------------

    const reasonParts = [];


    if (
        hotspot.riskScore >= 75
    ) {

        reasonParts.push(
            "High thermal intensity"
        );

    }

    else if (
        hotspot.riskScore >= 60
    ) {

        reasonParts.push(
            "Elevated thermal intensity"
        );

    }

    else {

        reasonParts.push(
            "Thermal activity detected"
        );

    }


    if (
        hotspot.industrialProximity
    ) {

        reasonParts.push(
            "Industrial zone within 5 km"
        );

    }


    if (
        hotspot.persistenceDetected
    ) {

        reasonParts.push(
            `Repeated activity across ${hotspot.persistenceDays} days`
        );

    }


    const threatReason =
        reasonParts.join(
            " + "
        );


    // --------------------------------------------------------
    // RETURN POPUP
    // --------------------------------------------------------

    return `

        <div style="
            font-family: Arial, sans-serif;
            min-width: 290px;
            max-width: 330px;
            color: #e5e7eb;
        ">

            <div style="
                font-size: 10px;
                letter-spacing: 1.5px;
                color: #94a3b8;
                margin-bottom: 5px;
            ">
                THERMOGUARD AI
            </div>


            <h3 style="
                margin: 0 0 14px;
                font-size: 18px;
                color: #f97316;
            ">
                🔥 THERMAL DETECTION
            </h3>


            <!-- THERMAL RISK -->

            <div style="
                background: #111827;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
                border: 1px solid #1f2937;
            ">

                <div style="
                    font-size: 10px;
                    color: #94a3b8;
                    letter-spacing: 1px;
                ">
                    THERMAL RISK
                </div>

                <div style="
                    font-size: 20px;
                    font-weight: bold;
                    margin-top: 4px;
                    color: ${riskColor};
                ">
                    ${hotspot.risk}
                </div>


                <div style="
                    margin-top: 8px;
                    font-size: 11px;
                    color: #94a3b8;
                ">
                    AI RISK SCORE
                </div>


                <div style="
                    font-size: 25px;
                    font-weight: bold;
                    color: white;
                    margin-top: 2px;
                ">
                    ${hotspot.riskScore}

                    <span style="
                        font-size: 12px;
                        color: #64748b;
                    ">
                        /100
                    </span>
                </div>

            </div>


            <!-- THREAT PRIORITY -->

            <div style="
                padding: 10px;
                margin-bottom: 10px;
                border-radius: 8px;
                background: rgba(249,115,22,0.07);
                border: 1px solid rgba(249,115,22,0.25);
            ">

                <div style="
                    font-size: 10px;
                    color: #94a3b8;
                    letter-spacing: 1px;
                ">
                    THREAT PRIORITY
                </div>

                <div style="
                    margin-top: 5px;
                    font-size: 16px;
                    font-weight: bold;
                    color: ${

                        hotspot.threatPriority ===
                        "CRITICAL"

                            ? "#ff3b30"

                            : hotspot.threatPriority ===
                              "HIGH"

                                ? "#ff9500"

                                : hotspot.threatPriority ===
                                  "MEDIUM"

                                    ? "#ffd60a"

                                    : "#34c759"

                    };
                ">
                    ${hotspot.threatPriority}
                </div>

            </div>


            <!-- WHY -->

            <div style="
                margin-top: 10px;
                padding: 10px;
                border-radius: 8px;
                background: rgba(249,115,22,0.08);
                border: 1px solid rgba(249,115,22,0.3);
            ">

                <div style="
                    font-size: 10px;
                    letter-spacing: 1px;
                    color: #94a3b8;
                ">
                    WHY THIS THREAT WAS PRIORITIZED
                </div>

                <div style="
                    margin-top: 7px;
                    font-size: 12px;
                    line-height: 1.7;
                    color: #f8fafc;
                ">
                    ${threatReason}
                </div>

            </div>


            <!-- THERMAL DATA -->

            <div style="
                margin-top: 12px;
                line-height: 1.8;
                font-size: 12px;
            ">

                <b>🔥 Fire Radiative Power:</b>
                ${hotspot.frp} MW<br>

                <b>🌡 Brightness:</b>
                ${hotspot.brightness} K<br>

                <b>🛰 Satellite:</b>
                ${hotspot.satellite || "N/A"}<br>

                <b>🎯 Confidence:</b>
                ${hotspot.confidence || "N/A"}<br>

                <b>📅 Date:</b>
                ${hotspot.acq_date || "N/A"}<br>

                <b>🕐 Time:</b>
                ${hotspot.acq_time || "N/A"} UTC<br>

                <b>📍 Coordinates:</b>
                ${hotspot.latitude.toFixed(5)},
                ${hotspot.longitude.toFixed(5)}

            </div>


            <!-- INDUSTRIAL CONTEXT -->

            <div style="
                margin-top: 12px;
                padding: 10px;
                border-radius: 8px;
                background: rgba(56,189,248,0.06);
                border: 1px solid rgba(56,189,248,0.25);
            ">

                <div style="
                    font-size: 10px;
                    letter-spacing: 1px;
                    color: #94a3b8;
                ">
                    INDUSTRIAL CONTEXT
                </div>

                <div style="
                    margin-top: 6px;
                    font-size: 12px;
                    color: ${industrialColor};
                ">
                    🏭 ${industrialStatus}
                </div>

                <div style="
                    margin-top: 5px;
                    font-size: 11px;
                    color: #cbd5e1;
                ">
                    Distance:
                    ${industrialDistanceText}
                </div>

            </div>


            <!-- PERSISTENCE -->

            ${
                hotspot.persistenceDetected

                    ? `

                    <div style="
                        margin-top: 12px;
                        padding: 10px;
                        border-radius: 8px;
                        background: rgba(255,149,0,0.08);
                        border: 1px solid ${persistenceColor};
                    ">

                        <div style="
                            font-size: 10px;
                            letter-spacing: 1px;
                            color: #94a3b8;
                        ">
                            🔥 PERSISTENCE INTELLIGENCE
                        </div>

                        <div style="
                            margin-top: 5px;
                            font-size: 17px;
                            font-weight: bold;
                            color: ${persistenceColor};
                        ">
                            ${hotspot.persistenceLevel}
                        </div>

                        <div style="
                            margin-top: 6px;
                            font-size: 12px;
                            line-height: 1.7;
                            color: #cbd5e1;
                        ">
                            Detected across
                            <b>${hotspot.persistenceDays}</b>
                            days<br>

                            Total detections:
                            <b>${hotspot.persistenceDetections}</b>
                        </div>

                        <div style="
                            margin-top: 7px;
                            font-size: 10px;
                            color: #fbbf24;
                        ">
                            ⚠ REPEATED THERMAL ACTIVITY
                        </div>

                    </div>

                    `

                    : ""
            }


            <!-- VERIFIED -->

            <div style="
                margin-top: 12px;
                padding-top: 8px;
                border-top: 1px solid #1f2937;
                font-size: 9px;
                letter-spacing: 1px;
                color: #34c759;
            ">
                ✓ NASA FIRMS DETECTION VERIFIED
            </div>

        </div>

    `;

}


// ============================================================
// UPDATE ALL HOTSPOT POPUPS
// ============================================================

function updateAllHotspotPopups() {

    hotspotData.forEach(
        hotspot => {

            if (
                hotspot.marker
            ) {

                hotspot.marker.bindPopup(
                    buildHotspotPopup(
                        hotspot
                    )
                );

            }

        }
    );

}


// ============================================================
// NASA FIRMS CSV
// ============================================================

fetch("../data/hotspots.csv")

    .then(
        response => {

            if (!response.ok) {

                throw new Error(
                    "Failed to load hotspots.csv"
                );

            }

            return response.text();

        }
    )

    .then(
        csvText => {

            const cleaned =
                csvText.trim();


            if (!cleaned) {

                throw new Error(
                    "hotspots.csv is empty"
                );

            }


            const rows =
                cleaned.split(/\r?\n/);


            const headers =
                rows[0]
                    .split(",")
                    .map(
                        header =>
                            header.trim()
                    );


            console.log(
                "NASA FIRMS CSV loaded"
            );

            console.log(
                `Total records: ${rows.length - 1}`
            );


            let highRiskCount = 0;
            let mediumRiskCount = 0;
            let lowRiskCount = 0;


            rows
                .slice(1)
                .forEach(
                    row => {

                        if (
                            !row.trim()
                        ) {

                            return;

                        }


                        const values =
                            row.split(",");

                        const hotspot = {};


                        headers.forEach(
                            (
                                header,
                                index
                            ) => {

                                hotspot[
                                    header
                                ] =
                                    values[
                                        index
                                    ]?.trim();

                            }
                        );


                        const latitude =
                            parseFloat(
                                hotspot.latitude
                            );

                        const longitude =
                            parseFloat(
                                hotspot.longitude
                            );

                        const brightness =
                            parseFloat(
                                hotspot.bright_ti4
                            );

                        const frp =
                            parseFloat(
                                hotspot.frp
                            );


                        if (
                            !Number.isFinite(
                                latitude
                            ) ||
                            !Number.isFinite(
                                longitude
                            )
                        ) {

                            return;

                        }


                        // ------------------------------------------------
                        // RISK CLASSIFICATION
                        // ------------------------------------------------

                        let risk =
                            "LOW";


                        if (
                            frp >= 6 ||
                            brightness >= 340
                        ) {

                            risk =
                                "HIGH";

                            highRiskCount++;

                        }

                        else if (
                            frp >= 3 ||
                            brightness >= 325
                        ) {

                            risk =
                                "MEDIUM";

                            mediumRiskCount++;

                        }

                        else {

                            risk =
                                "LOW";

                            lowRiskCount++;

                        }


                        // ------------------------------------------------
                        // PROTOTYPE THERMAL RISK SCORE
                        // ------------------------------------------------

                        let riskScore =

                            (frp / 8.05) *
                            60 +

                            (
                                (brightness - 290) /
                                55
                            ) *
                            40;


                        riskScore =
                            Math.round(
                                Math.max(
                                    0,
                                    Math.min(
                                        100,
                                        riskScore
                                    )
                                )
                            );


                        // ------------------------------------------------
                        // MARKER COLOR
                        // ------------------------------------------------

                        const riskColor =

                            risk === "HIGH"

                                ? "#ff3b30"

                                : risk === "MEDIUM"

                                    ? "#ff9500"

                                    : "#34c759";


                        // ------------------------------------------------
                        // MAIN MARKER
                        // ------------------------------------------------

                        const marker =
                            L.circleMarker(
                                [
                                    latitude,
                                    longitude
                                ],
                                {
                                    radius:
                                        risk === "HIGH"
                                            ? 11
                                            : risk === "MEDIUM"
                                                ? 9
                                                : 7,

                                    color:
                                        riskColor,

                                    fillColor:
                                        riskColor,

                                    weight: 2,

                                    opacity: 1,

                                    fillOpacity:
                                        0.9
                                }
                            )
                            .addTo(
                                thermoguardMap
                            );


                        // ------------------------------------------------
                        // HIGH RISK HALO
                        // ------------------------------------------------

                        if (
                            risk === "HIGH"
                        ) {

                            L.circleMarker(
                                [
                                    latitude,
                                    longitude
                                ],
                                {
                                    radius: 18,

                                    color:
                                        "#ff3b30",

                                    fillColor:
                                        "#ff3b30",

                                    weight: 1,

                                    opacity:
                                        0.35,

                                    fillOpacity:
                                        0.12
                                }
                            )
                            .addTo(
                                thermoguardMap
                            );

                        }


                        // ------------------------------------------------
                        // STORE HOTSPOT
                        // ------------------------------------------------

                        const hotspotObject = {

                            latitude,

                            longitude,

                            risk,

                            riskScore,

                            frp,

                            brightness,

                            confidence:
                                hotspot.confidence,

                            satellite:
                                hotspot.satellite,

                            acq_date:
                                hotspot.acq_date,

                            acq_time:
                                hotspot.acq_time,

                            marker,

                            industrialProximity:
                                false,

                            nearestIndustrialDistance:
                                Infinity,

                            threatPriority:
                                "LOW",

                            persistenceDetected:
                                false,

                            persistenceLevel:
                                "NONE",

                            persistenceDays:
                                0,

                            persistenceDetections:
                                0

                        };


                        hotspotData.push(
                            hotspotObject
                        );


                        // ------------------------------------------------
                        // INITIAL POPUP
                        // ------------------------------------------------

                        marker.bindPopup(
                            buildHotspotPopup(
                                hotspotObject
                            )
                        );

                    }
                );


            // ------------------------------------------------
            // KPI UPDATE
            // ------------------------------------------------

            const hotspotElement =
                document.getElementById(
                    "hotspotCount"
                );

            if (
                hotspotElement
            ) {

                hotspotElement.textContent =
                    hotspotData.length;

            }


            const highElement =
                document.getElementById(
                    "highRiskCount"
                );

            if (
                highElement
            ) {

                highElement.textContent =
                    highRiskCount;

            }


            const mediumElement =
                document.getElementById(
                    "mediumRiskCount"
                );

            if (
                mediumElement
            ) {

                mediumElement.textContent =
                    mediumRiskCount;

            }


            // Low risk is calculated but
            // does not require a dashboard card.
            void lowRiskCount;


            renderThreatFeed();

            updateIntelligenceOverview();

            console.log(
                "ThermoGuard AI — Hotspot intelligence ready."
            );

        }
    )

    .catch(
        error => {

            console.error(
                "NASA FIRMS data error:",
                error
            );

        }
    );


// ============================================================
// INDUSTRIAL PROXIMITY + THREAT ANALYSIS
// ============================================================

function analyzeIndustrialProximity() {

    if (
        !hotspotData.length
    ) {

        return;

    }


    const INDUSTRIAL_THRESHOLD =
        5000;


    let industrialThreatCount =
        0;

    let criticalThreatCount =
        0;


    hotspotData.forEach(
        hotspot => {

            let nearestDistance =
                Infinity;


            // ------------------------------------------------
            // FIND NEAREST INDUSTRIAL AREA
            // ------------------------------------------------

            industrialAreas.forEach(
                area => {

                    const distance =
                        distanceToIndustrialArea(
                            hotspot.latitude,
                            hotspot.longitude,
                            area
                        );


                    if (
                        distance <
                        nearestDistance
                    ) {

                        nearestDistance =
                            distance;

                    }

                }
            );


            hotspot.nearestIndustrialDistance =
                nearestDistance;


            hotspot.industrialProximity =

                nearestDistance <=
                INDUSTRIAL_THRESHOLD;


            if (
                hotspot.industrialProximity
            ) {

                industrialThreatCount++;

            }


            // ------------------------------------------------
            // THREAT PRIORITY ENGINE
            // ------------------------------------------------

            if (
                hotspot.riskScore >= 75 &&
                hotspot.industrialProximity
            ) {

                hotspot.threatPriority =
                    "CRITICAL";

            }

            else if (
                hotspot.riskScore >= 60 ||
                hotspot.industrialProximity
            ) {

                hotspot.threatPriority =
                    "HIGH";

            }

            else if (
                hotspot.riskScore >= 35
            ) {

                hotspot.threatPriority =
                    "MEDIUM";

            }

            else {

                hotspot.threatPriority =
                    "LOW";

            }


            if (
                hotspot.threatPriority ===
                "CRITICAL"
            ) {

                criticalThreatCount++;

            }

        }
    );


    // --------------------------------------------------------
    // KPI
    // --------------------------------------------------------

    const industrialElement =
        document.getElementById(
            "industrialCount"
        );

    if (
        industrialElement
    ) {

        industrialElement.textContent =
            industrialThreatCount;

    }


    const criticalElement =
        document.getElementById(
            "criticalCount"
        );

    if (
        criticalElement
    ) {

        criticalElement.textContent =
            criticalThreatCount;

    }


    updateAllHotspotPopups();

    renderThreatFeed();

    updateIntelligenceOverview();


    console.log(
        `Industrial proximity analysis complete: ${industrialThreatCount} nearby events`
    );

    console.log(
        `Critical threats: ${criticalThreatCount}`
    );

}


// ============================================================
// LOAD INDUSTRIAL CONTEXT
// Start after map is ready.
// ============================================================

setTimeout(
    () => {

        loadIndustrialContext();

    },
    800
);


// ============================================================
// PERSISTENCE DATA
// ============================================================

fetch("../data/persistence_results.csv")

    .then(
        response => {

            if (!response.ok) {

                throw new Error(
                    "Failed to load persistence_results.csv"
                );

            }

            return response.text();

        }
    )

    .then(
        csvText => {

            const rows =
                csvText
                    .trim()
                    .split(/\r?\n/);


            if (
                rows.length < 2
            ) {

                return;

            }


            const headers =
                rows[0]
                    .split(",")
                    .map(
                        header =>
                            header.trim()
                    );


            persistenceData = [];


            rows
                .slice(1)
                .forEach(
                    row => {

                        if (
                            !row.trim()
                        ) {

                            return;

                        }


                        const values =
                            row.split(",");

                        const item = {};


                        headers.forEach(
                            (
                                header,
                                index
                            ) => {

                                item[
                                    header
                                ] =
                                    values[
                                        index
                                    ]?.trim();

                            }
                        );


                        item.latitude =
                            parseFloat(
                                item.latitude
                            );

                        item.longitude =
                            parseFloat(
                                item.longitude
                            );

                        item.days_detected =
                            parseInt(
                                item.days_detected
                            ) || 0;

                        item.total_detections =
                            parseInt(
                                item.total_detections
                            ) || 0;


                        persistenceData.push(
                            item
                        );

                    }
                );


            // ------------------------------------------------
            // DRAW PERSISTENCE SOURCES
            // ------------------------------------------------

            persistenceLayer.clearLayers();


            persistenceData.forEach(
                persistence => {

                    if (
                        !Number.isFinite(
                            persistence.latitude
                        ) ||
                        !Number.isFinite(
                            persistence.longitude
                        )
                    ) {

                        return;

                    }


                    let color =
                        "#ffd60a";


                    if (
                        persistence.persistence_level ===
                        "HIGH"
                    ) {

                        color =
                            "#ff9500";

                    }

                    else if (
                        persistence.persistence_level ===
                        "VERY HIGH"
                    ) {

                        color =
                            "#ff3b30";

                    }


                    // Outer persistence ring

                    L.circle(
                        [
                            persistence.latitude,
                            persistence.longitude
                        ],
                        {
                            radius: 17000,

                            color,

                            weight: 2,

                            opacity: 0.75,

                            fillColor: color,

                            fillOpacity: 0.04
                        }
                    )
                    .bindPopup(`

                        <div style="
                            font-family: Arial, sans-serif;
                            min-width: 230px;
                            color: #e5e7eb;
                        ">

                            <div style="
                                font-size: 10px;
                                letter-spacing: 1px;
                                color: #94a3b8;
                            ">
                                THERMOGUARD AI
                            </div>

                            <h3 style="
                                margin: 6px 0 12px;
                                color: ${color};
                                font-size: 17px;
                            ">
                                🔥 PERSISTENT SOURCE
                            </h3>

                            <div style="
                                line-height: 1.8;
                                font-size: 12px;
                            ">

                                <b>Persistence:</b>
                                ${persistence.persistence_level}
                                <br>

                                <b>Days detected:</b>
                                ${persistence.days_detected}
                                <br>

                                <b>Total detections:</b>
                                ${persistence.total_detections}
                                <br>

                                <b>First detected:</b>
                                ${persistence.first_detected}
                                <br>

                                <b>Last detected:</b>
                                ${persistence.last_detected}

                            </div>

                        </div>

                    `)
                    .addTo(
                        persistenceLayer
                    );


                    // Inner persistence core

                    L.circleMarker(
                        [
                            persistence.latitude,
                            persistence.longitude
                        ],
                        {
                            radius: 5,

                            color,

                            fillColor: color,

                            weight: 2,

                            fillOpacity: 1
                        }
                    )
                    .addTo(
                        persistenceLayer
                    );

                }
            );


            // ------------------------------------------------
            // MATCH PERSISTENCE WITH HOTSPOTS
            // ------------------------------------------------

            matchPersistenceToHotspots();


            // ------------------------------------------------
            // PERSISTENCE KPI
            // ------------------------------------------------

            const persistentElement =
                document.getElementById(
                    "persistentCount"
                );

            if (
                persistentElement
            ) {

                persistentElement.textContent =
                    persistenceData.length;

            }


            // ------------------------------------------------
            // SUMMARY
            // ------------------------------------------------

            const veryHighCount =
                persistenceData.filter(
                    item =>
                        item.persistence_level ===
                        "VERY HIGH"
                ).length;


            const highPersistenceCount =
                persistenceData.filter(
                    item =>
                        item.persistence_level ===
                        "HIGH"
                ).length;


            const mediumPersistenceCount =
                persistenceData.filter(
                    item =>
                        item.persistence_level ===
                        "MEDIUM"
                ).length;


            console.log(
                "=========================================="
            );

            console.log(
                "THERMOGUARD AI — PERSISTENCE ANALYSIS"
            );

            console.log(
                `Persistent sources: ${persistenceData.length}`
            );

            console.log(
                `Very High: ${veryHighCount}`
            );

            console.log(
                `High: ${highPersistenceCount}`
            );

            console.log(
                `Medium: ${mediumPersistenceCount}`
            );

            console.log(
                "=========================================="
            );


            updateAllHotspotPopups();

            renderThreatFeed();

            updateIntelligenceOverview();

        }
    )

    .catch(
        error => {

            console.warn(
                "Persistence intelligence unavailable:",
                error.message
            );

        }
    );


// ============================================================
// MATCH PERSISTENT SOURCES TO HOTSPOTS
// ============================================================

function matchPersistenceToHotspots() {

    if (
        !hotspotData.length ||
        !persistenceData.length
    ) {

        return;

    }


    const MATCH_DISTANCE =
        5000;


    hotspotData.forEach(
        hotspot => {

            let closestPersistence =
                null;

            let closestDistance =
                Infinity;


            persistenceData.forEach(
                persistence => {

                    const distance =
                        distanceInMeters(
                            hotspot.latitude,
                            hotspot.longitude,
                            persistence.latitude,
                            persistence.longitude
                        );


                    if (
                        distance <
                        closestDistance
                    ) {

                        closestDistance =
                            distance;

                        closestPersistence =
                            persistence;

                    }

                }
            );


            if (
                closestPersistence &&
                closestDistance <=
                MATCH_DISTANCE
            ) {

                hotspot.persistenceDetected =
                    true;

                hotspot.persistenceLevel =
                    closestPersistence.persistence_level;

                hotspot.persistenceDays =
                    closestPersistence.days_detected;

                hotspot.persistenceDetections =
                    closestPersistence.total_detections;

            }

        }
    );


    // Persistence can change the reason
    // displayed in hotspot popups.
    updateAllHotspotPopups();

}


// ============================================================
// LIVE THREAT FEED
// ============================================================

function renderThreatFeed() {

    const feed =
        document.getElementById(
            "threatFeedList"
        );


    const feedCount =
        document.getElementById(
            "feedEventCount"
        );


    if (
        !feed
    ) {

        return;

    }


    if (
        !hotspotData.length
    ) {

        feed.innerHTML = `

            <div class="feed-empty">
                Analyzing thermal events...
            </div>

        `;

        return;

    }


    const priorityOrder = {

        CRITICAL: 4,

        HIGH: 3,

        MEDIUM: 2,

        LOW: 1

    };


    const sortedThreats =
        [...hotspotData].sort(
            (
                a,
                b
            ) => {

                const priorityDifference =
                    (
                        priorityOrder[
                            b.threatPriority
                        ] || 0
                    ) -
                    (
                        priorityOrder[
                            a.threatPriority
                        ] || 0
                    );


                if (
                    priorityDifference !== 0
                ) {

                    return priorityDifference;

                }


                return (
                    b.riskScore -
                    a.riskScore
                );

            }
        );


    const visibleThreats =
        sortedThreats.slice(
            0,
            8
        );


    feed.innerHTML =
        visibleThreats
            .map(
                (
                    threat,
                    index
                ) => {

                    let priorityColor =
                        "#34c759";


                    if (
                        threat.threatPriority ===
                        "CRITICAL"
                    ) {

                        priorityColor =
                            "#ff3b30";

                    }

                    else if (
                        threat.threatPriority ===
                        "HIGH"
                    ) {

                        priorityColor =
                            "#ff9500";

                    }

                    else if (
                        threat.threatPriority ===
                        "MEDIUM"
                    ) {

                        priorityColor =
                            "#ffd60a";

                    }


                    const riskScore =
                        Math.round(
                            threat.riskScore || 0
                        );


                    const totalSegments =
                        20;


                    const filledSegments =
                        Math.round(
                            (
                                riskScore /
                                100
                            ) *
                            totalSegments
                        );


                    const severityBar =

                        "█".repeat(
                            Math.max(
                                0,
                                filledSegments
                            )
                        ) +

                        "░".repeat(
                            Math.max(
                                0,
                                totalSegments -
                                filledSegments
                            )
                        );


                    let persistenceText =
                        "No persistent source linked";


                    if (
                        threat.persistenceDetected
                    ) {

                        persistenceText =
                            `${threat.persistenceLevel} • ` +
                            `${threat.persistenceDays} DAY` +
                            (
                                threat.persistenceDays > 1
                                    ? "S"
                                    : ""
                            );

                    }


                    let industrialText =
                        "No nearby industrial zone";


                    if (
                        industrialContextUnavailable
                    ) {

                        industrialText =
                            "Industrial context unavailable";

                    }

                    else if (
                        threat.nearestIndustrialDistance !==
                        Infinity
                    ) {

                        industrialText =
                            (
                                threat.nearestIndustrialDistance /
                                1000
                            ).toFixed(2) +
                            " KM";

                    }


                    return `

                        <div
                            class="threat-item"
                            data-threat-index="${index}"
                            style="
                                cursor:pointer;
                                padding:12px 14px;
                                margin-bottom:8px;
                                border-radius:9px;
                                background:rgba(255,255,255,0.025);
                                border:1px solid rgba(255,255,255,0.07);
                                transition:all 0.2s ease;
                            "
                        >

                            <div style="
                                display:flex;
                                justify-content:space-between;
                                align-items:center;
                            ">

                                <div style="
                                    color:${priorityColor};
                                    font-size:11px;
                                    font-weight:700;
                                    letter-spacing:1px;
                                ">
                                    ${threat.threatPriority}
                                </div>

                                <div style="
                                    font-size:11px;
                                    color:#e5e7eb;
                                    font-weight:600;
                                ">
                                    RISK ${riskScore}/100
                                </div>

                            </div>


                            <div style="
                                margin-top:7px;
                                font-family:monospace;
                                font-size:10px;
                                color:${priorityColor};
                                white-space:nowrap;
                                overflow:hidden;
                                text-shadow:0 0 6px ${priorityColor};
                            ">
                                ${severityBar}
                            </div>


                            <div style="
                                margin-top:5px;
                                font-size:9px;
                                color:#64748b;
                                letter-spacing:.8px;
                            ">
                                THREAT INTENSITY
                            </div>


                            <div style="
                                margin-top:8px;
                                font-size:11px;
                                color:#cbd5e1;
                            ">
                                📍
                                ${threat.latitude.toFixed(4)},
                                ${threat.longitude.toFixed(4)}
                            </div>


                            <div style="
                                margin-top:6px;
                                font-size:10px;
                                color:#94a3b8;
                            ">
                                🔥 ${threat.risk}
                                &nbsp; • &nbsp;
                                ${persistenceText}
                            </div>


                            <div style="
                                margin-top:5px;
                                font-size:10px;
                                color:#94a3b8;
                            ">
                                🏭 ${industrialText}
                            </div>

                        </div>

                    `;

                }
            )
            .join("");


    if (
        feedCount
    ) {

        feedCount.textContent =
            `${hotspotData.length} ACTIVE EVENTS`;

    }


    // --------------------------------------------------------
    // FEED CLICK + HOVER
    // --------------------------------------------------------

    const feedItems =
        feed.querySelectorAll(
            ".threat-item"
        );


    feedItems.forEach(
        item => {

            item.addEventListener(
                "click",
                () => {

                    const index =
                        parseInt(
                            item.dataset.threatIndex
                        );


                    const threat =
                        visibleThreats[
                            index
                        ];


                    if (
                        !threat ||
                        !threat.marker
                    ) {

                        return;

                    }


                    thermoguardMap.flyTo(
                        [
                            threat.latitude,
                            threat.longitude
                        ],
                        13,
                        {
                            duration: 1.2
                        }
                    );


                    setTimeout(
                        () => {

                            threat.marker.openPopup();

                        },
                        700
                    );

                }
            );


            item.addEventListener(
                "mouseenter",
                () => {

                    item.style.background =
                        "rgba(249,115,22,0.07)";

                    item.style.borderColor =
                        "rgba(249,115,22,0.30)";

                    item.style.transform =
                        "translateX(3px)";

                }
            );


            item.addEventListener(
                "mouseleave",
                () => {

                    item.style.background =
                        "rgba(255,255,255,0.025)";

                    item.style.borderColor =
                        "rgba(255,255,255,0.07)";

                    item.style.transform =
                        "translateX(0)";

                }
            );

        }
    );


}


// ============================================================
// THERMAL INTELLIGENCE OVERVIEW
// ============================================================

function updateIntelligenceOverview() {

    if (
        !hotspotData.length
    ) {

        return;

    }


    const highRisk =
        hotspotData.filter(
            hotspot =>
                hotspot.risk ===
                "HIGH"
        ).length;


    const mediumRisk =
        hotspotData.filter(
            hotspot =>
                hotspot.risk ===
                "MEDIUM"
        ).length;


    const criticalThreats =
        hotspotData.filter(
            hotspot =>
                hotspot.threatPriority ===
                "CRITICAL"
        ).length;


    const industrialThreats =
        hotspotData.filter(
            hotspot =>
                hotspot.industrialProximity
        ).length;


    const persistentSources =
        hotspotData.filter(
            hotspot =>
                hotspot.persistenceDetected
        ).length;


    const activeHotspots =
        hotspotData.length;


    // --------------------------------------------------------
    // BASIC COUNTERS
    // --------------------------------------------------------

    const elements = {

        overviewHighRisk:
            highRisk,

        overviewMediumRisk:
            mediumRisk,

        overviewCritical:
            criticalThreats,

        overviewIndustrial:
            industrialThreats,

        overviewPersistent:
            persistentSources,

        overviewActive:
            activeHotspots

    };


    Object.entries(
        elements
    ).forEach(
        (
            [
                id,
                value
            ]
        ) => {

            const element =
                document.getElementById(
                    id
                );


            if (
                element
            ) {

                element.textContent =
                    value;

            }

        }
    );


    // --------------------------------------------------------
    // AVERAGE RISK
    // --------------------------------------------------------

    const totalRiskScore =
        hotspotData.reduce(
            (
                total,
                hotspot
            ) =>
                total +
                (
                    Number(
                        hotspot.riskScore
                    ) || 0
                ),
            0
        );


    const averageRisk =
        totalRiskScore /
        hotspotData.length;


    // --------------------------------------------------------
    // INTELLIGENCE WEIGHTING
    // --------------------------------------------------------

    const criticalWeight =
        criticalThreats * 8;


    const industrialWeight =
        industrialThreats * 2;


    const persistenceWeight =
        persistentSources * 1.5;


    let threatIndex =
        averageRisk +
        criticalWeight +
        industrialWeight +
        persistenceWeight;


    threatIndex =
        Math.round(
            Math.max(
                0,
                Math.min(
                    100,
                    threatIndex
                )
            )
        );


    // --------------------------------------------------------
    // THREAT STATUS
    // --------------------------------------------------------

    let threatLabel =
        "LOW";


    let threatDescription =
        "Thermal activity currently remains within a lower priority range.";


    if (
        threatIndex >= 75
    ) {

        threatLabel =
            "CRITICAL";


        threatDescription =
            "Multiple high-intensity indicators require immediate attention.";

    }

    else if (
        threatIndex >= 60
    ) {

        threatLabel =
            "HIGH";


        threatDescription =
            "Elevated thermal activity detected across monitored areas.";

    }

    else if (
        threatIndex >= 35
    ) {

        threatLabel =
            "MODERATE";


        threatDescription =
            "Thermal activity requires continued monitoring.";

    }


    // --------------------------------------------------------
    // INDEX
    // --------------------------------------------------------

    const indexElement =
        document.getElementById(
            "overviewThreatIndex"
        );


    if (
        indexElement
    ) {

        indexElement.textContent =
            threatIndex;

    }


    // --------------------------------------------------------
    // LABEL
    // --------------------------------------------------------

    const labelElement =
        document.getElementById(
            "overviewThreatLabel"
        );


    if (
        labelElement
    ) {

        labelElement.textContent =
            threatLabel;


        labelElement.style.color =

            threatIndex >= 75

                ? "#ff3b30"

                : threatIndex >= 60

                    ? "#ff9500"

                    : threatIndex >= 35

                        ? "#ffd60a"

                        : "#34c759";

    }


    // --------------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------------

    const descriptionElement =
        document.getElementById(
            "overviewThreatDescription"
        );


    if (
        descriptionElement
    ) {

        descriptionElement.textContent =
            threatDescription;

    }


    // --------------------------------------------------------
    // DISTRIBUTION BARS
    // --------------------------------------------------------

    const highBar =
        document.getElementById(
            "highRiskBar"
        );


    const mediumBar =
        document.getElementById(
            "mediumRiskBar"
        );


    const criticalBar =
        document.getElementById(
            "criticalRiskBar"
        );


    if (
        activeHotspots > 0
    ) {

        if (
            highBar
        ) {

            highBar.style.width =
                (
                    highRisk /
                    activeHotspots *
                    100
                ) + "%";

        }


        if (
            mediumBar
        ) {

            mediumBar.style.width =
                (
                    mediumRisk /
                    activeHotspots *
                    100
                ) + "%";

        }


        if (
            criticalBar
        ) {

            criticalBar.style.width =
                (
                    criticalThreats /
                    activeHotspots *
                    100
                ) + "%";

        }

    }


    console.log(
        `Threat Index: ${threatIndex}/100`
    );

}


// ============================================================
// INITIALIZATION
// ============================================================

console.log(
    "ThermoGuard AI map initialized."
);


// ============================================================
// INITIAL REFRESH
// ============================================================

setTimeout(
    () => {

        renderThreatFeed();

        updateIntelligenceOverview();

    },
    1500
);


// ============================================================
// CONTINUOUS INTELLIGENCE REFRESH
// ============================================================

setInterval(
    () => {

        if (
            hotspotData.length
        ) {

            renderThreatFeed();

            updateIntelligenceOverview();

        }

    },
    3000
);