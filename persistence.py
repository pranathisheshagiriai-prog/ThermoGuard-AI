import csv
import os
import math
from collections import defaultdict

# ==========================================
# THERMOGUARD AI — PERSISTENCE ENGINE
# ==========================================

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

INPUT_FILE = os.path.join(DATA_DIR, "firms_history.csv")
OUTPUT_FILE = os.path.join(DATA_DIR, "persistence_results.csv")


# Distance between two GPS points in kilometres
def distance_km(lat1, lon1, lat2, lon2):

    R = 6371

    lat1 = math.radians(lat1)
    lat2 = math.radians(lat2)

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


print("==========================================")
print("THERMOGUARD AI — PERSISTENCE ENGINE")
print("==========================================")

if not os.path.exists(INPUT_FILE):

    print("Historical FIRMS file not found ❌")
    print(INPUT_FILE)
    exit()

# ==========================================
# READ FIRMS DATA
# ==========================================

with open(INPUT_FILE, "r", encoding="utf-8") as file:

    reader = csv.DictReader(file)

    hotspots = []

    for row in reader:

        try:

            hotspots.append({
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "date": row["acq_date"],
                "frp": float(row["frp"]),
                "brightness": float(row["bright_ti4"])
            })

        except (ValueError, KeyError):

            continue


print(f"Thermal detections loaded: {len(hotspots)}")

# ==========================================
# GROUP HOTSPOTS BY LOCATION
# ==========================================

clusters = []

DISTANCE_THRESHOLD_KM = 5

for hotspot in hotspots:

    assigned = False

    for cluster in clusters:

        center = cluster["center"]

        distance = distance_km(
            hotspot["latitude"],
            hotspot["longitude"],
            center["latitude"],
            center["longitude"]
        )

        if distance <= DISTANCE_THRESHOLD_KM:

            cluster["detections"].append(hotspot)

            # Update approximate center
            count = len(cluster["detections"])

            cluster["center"]["latitude"] = (
                sum(
                    item["latitude"]
                    for item in cluster["detections"]
                ) / count
            )

            cluster["center"]["longitude"] = (
                sum(
                    item["longitude"]
                    for item in cluster["detections"]
                ) / count
            )

            assigned = True
            break

    if not assigned:

        clusters.append({
            "center": {
                "latitude": hotspot["latitude"],
                "longitude": hotspot["longitude"]
            },
            "detections": [hotspot]
        })


# ==========================================
# ANALYZE PERSISTENCE
# ==========================================

persistent_sources = []

for cluster in clusters:

    detections = cluster["detections"]

    dates = set(
        detection["date"]
        for detection in detections
    )

    days_detected = len(dates)

    total_detections = len(detections)

    # Persistence classification
    if days_detected >= 4:

        persistence_level = "VERY HIGH"

    elif days_detected >= 3:

        persistence_level = "HIGH"

    elif days_detected >= 2:

        persistence_level = "MEDIUM"

    else:

        persistence_level = "SINGLE EVENT"

    # Only store meaningful persistent sources
    if days_detected >= 2:

        persistent_sources.append({

            "latitude": round(
                cluster["center"]["latitude"], 6
            ),

            "longitude": round(
                cluster["center"]["longitude"], 6
            ),

            "days_detected": days_detected,

            "total_detections": total_detections,

            "persistence_level": persistence_level,

            "first_detected": min(dates),

            "last_detected": max(dates)
        })


# ==========================================
# SAVE RESULTS
# ==========================================

with open(
    OUTPUT_FILE,
    "w",
    newline="",
    encoding="utf-8"
) as file:

    fieldnames = [
        "latitude",
        "longitude",
        "days_detected",
        "total_detections",
        "persistence_level",
        "first_detected",
        "last_detected"
    ]

    writer = csv.DictWriter(
        file,
        fieldnames=fieldnames
    )

    writer.writeheader()

    writer.writerows(persistent_sources)


# ==========================================
# FINAL REPORT
# ==========================================

print()
print("Persistence analysis complete! 🚀")
print()
print(f"Persistent sources: {len(persistent_sources)}")
print()
print("Persistence levels:")

for level in [
    "VERY HIGH",
    "HIGH",
    "MEDIUM"
]:

    count = sum(
        1
        for source in persistent_sources
        if source["persistence_level"] == level
    )

    print(f"{level}: {count}")

print()
print("Saved to:")
print(OUTPUT_FILE)

print()
print("==========================================")
print("PERSISTENCE ENGINE ONLINE")
print("==========================================")