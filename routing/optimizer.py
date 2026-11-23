
from math import radians, sin, cos, sqrt, atan2


def calculate_distance(point1, point2):
    """
    Calculate the straight-line distance between two locations
    using their latitude and longitude.
    Returns distance in kilometres.
    """
    lat1, lon1 = point1
    lat2, lon2 = point2

    earth_radius = 6371.0

    lat1, lon1, lat2, lon2 = map(
        radians, [lat1, lon1, lat2, lon2]
    )

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return earth_radius * c


def optimize_route(depot, stops):
    """
    Order collection stops using the nearest-neighbour method.
    The vehicle starts and finishes at the depot.

    depot: (latitude, longitude)
    stops: list of dictionaries containing name and coordinates
    """
    remaining = stops.copy()
    ordered_stops = []
    current_location = depot
    total_distance = 0.0

    while remaining:
        nearest_stop = min(
            remaining,
            key=lambda stop: calculate_distance(
                current_location,
                (stop["latitude"], stop["longitude"])
            )
        )

        distance = calculate_distance(
            current_location,
            (nearest_stop["latitude"], nearest_stop["longitude"])
        )

        total_distance += distance
        ordered_stops.append(nearest_stop)
        current_location = (
            nearest_stop["latitude"],
            nearest_stop["longitude"]
        )
        remaining.remove(nearest_stop)

    # Return to the depot after the last collection stop.
    total_distance += calculate_distance(current_location, depot)

    return {
        "ordered_stops": ordered_stops,
        "total_distance_km": round(total_distance, 2)
    }
