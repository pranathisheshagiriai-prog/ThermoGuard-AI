import requests
import os

# ==========================================
# THERMOGUARD AI — NASA FIRMS DATA ENGINE
# ==========================================

# Read NASA FIRMS MAP_KEY securely from
# the Windows environment variable.
MAP_KEY = os.getenv("NASA_FIRMS_MAP_KEY")

if not MAP_KEY:
    print("==========================================")
    print("THERMOGUARD AI — NASA FIRMS DATA ENGINE")
    print("==========================================")
    print()
    print("ERROR: NASA_FIRMS_MAP_KEY is not set.")
    print()
    print("Please set your NASA FIRMS MAP_KEY as a Windows environment variable.")
    print()
    exit(1)


# ==========================================
# FIRMS API
# 5 = retrieve the most recent 5 days
# ==========================================

url = (
    f"https://firms.modaps.eosdis.nasa.gov/"
    f"api/area/csv/"
    f"{MAP_KEY}/"
    f"VIIRS_NOAA21_NRT/"
    f"77,13,81,19/"
    f"5"
)


# ==========================================
# START
# ==========================================

print("==========================================")
print("THERMOGUARD AI — NASA FIRMS DATA ENGINE")
print("==========================================")
print("Requesting 5 days of thermal data...")
print()


# ==========================================
# REQUEST DATA
# ==========================================

try:

    response = requests.get(
        url,
        timeout=60
    )

    print("Status Code:", response.status_code)

except requests.RequestException as error:

    print()
    print("NASA FIRMS connection failed ❌")
    print()
    print("Error:")
    print(error)
    exit(1)


# ==========================================
# SUCCESS
# ==========================================

if response.status_code == 200:

    # Create data folder
    data_folder = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "data"
    )

    os.makedirs(
        data_folder,
        exist_ok=True
    )


    # ======================================
    # SAVE HISTORICAL FIRMS DATA
    # ======================================

    history_file = os.path.join(
        data_folder,
        "firms_history.csv"
    )

    with open(
        history_file,
        "w",
        encoding="utf-8"
    ) as file:

        file.write(response.text)


    # ======================================
    # SUCCESS INFORMATION
    # ======================================

    print()
    print("NASA FIRMS historical data downloaded successfully! 🚀")
    print()

    print("Saved to:")
    print(history_file)
    print()

    print("Data range: Latest 5 days")
    print("Satellite: NOAA-21")
    print("Sensor: VIIRS")
    print("Area: 77°E–81°E, 13°N–19°N")
    print()

    print("==========================================")
    print("PERSISTENCE DATA READY")
    print("==========================================")
    print()

else:

    print()
    print("NASA FIRMS connection failed ❌")
    print()
    print("HTTP Status:", response.status_code)
    print()
    print("Response:")
    print(response.text)