import requests

OSRM_URL = "https://router.project-osrm.org"


def get_road_distance_matrix(depot, stops):
    """
    Get road-distance and travel-duration matrices from OSRM.

    depot: (latitude, longitude)
    stops: list of stops containing latitude and longitude
    """

    locations = [depot]

    for stop in stops:
        locations.append(
            (stop["latitude"], stop["longitude"])
        )

    # OSRM expects longitude,latitude.
    coordinates = ";".join(
        f"{longitude},{latitude}"
        for latitude, longitude in locations
    )

    url = f"{OSRM_URL}/table/v1/driving/{coordinates}"

    response = requests.get(
        url,
        params={"annotations": "distance,duration"},
        timeout=20,
    )

    response.raise_for_status()
    data = response.json()

    if data.get("code") != "Ok":
        raise RuntimeError(
            f"OSRM routing failed: {data.get('code')}"
        )

    distance_matrix = [
        [
            round(distance / 1000, 2)
            if distance is not None
            else None
            for distance in row
        ]
        for row in data["distances"]
    ]

    duration_matrix = [
        [
            round(duration / 60, 2)
            if duration is not None
            else None
            for duration in row
        ]
        for row in data["durations"]
    ]

    return {
        "road_distance_matrix_km": distance_matrix,
        "travel_duration_matrix_min": duration_matrix,
        "source": "OSRM_OpenStreetMap",
    }


def get_road_route_geometry(depot, ordered_stops):
    """
    Get road-route geometry from OSRM.

    The route starts at the depot, visits stops in order,
    and returns to the depot.
    """

    locations = [depot]

    for stop in ordered_stops:
        locations.append(
            (stop["latitude"], stop["longitude"])
        )

    # Return to the depot.
    locations.append(depot)

    # OSRM expects longitude,latitude.
    coordinates = ";".join(
        f"{longitude},{latitude}"
        for latitude, longitude in locations
    )

    url = f"{OSRM_URL}/route/v1/driving/{coordinates}"

    response = requests.get(
        url,
        params={
            "overview": "full",
            "geometries": "geojson",
        },
        timeout=20,
    )

    response.raise_for_status()
    data = response.json()

    if data.get("code") != "Ok" or not data.get("routes"):
        raise RuntimeError(
            f"OSRM route geometry failed: {data.get('code')}"
        )

    route = data["routes"][0]

    # GeoJSON uses [longitude, latitude].
    # Convert to [latitude, longitude] for map display.
    geometry = [
        [latitude, longitude]
        for longitude, latitude in route["geometry"]["coordinates"]
    ]

    return {
        "route_geometry": geometry,
        "geometry_distance_km": round(
            route["distance"] / 1000, 2
        ),
        "geometry_duration_min": round(
            route["duration"] / 60, 2
        ),
        "geometry_source": "OSRM_OpenStreetMap",
    }