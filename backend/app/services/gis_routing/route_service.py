
from app.services.gis_routing.road_routing import (
    get_road_distance_matrix,
    get_road_route_geometry,
)

from app.services.gis_routing.road_optimizer import (
    optimize_road_route,
    calculate_route_distance,
    calculate_route_time,
)


def create_route(depot, stops):
    """
    Create an optimized waste-collection route.
    Starts at the depot, visits all stops and returns to the depot.
    """

    road_data = get_road_distance_matrix(depot, stops)

    distance_matrix = road_data["road_distance_matrix_km"]
    duration_matrix = road_data["travel_duration_matrix_min"]

    # Original route distance
    baseline_indices = list(range(1, len(stops) + 1))

    baseline_distance = calculate_route_distance(
        distance_matrix,
        baseline_indices,
    )

    # Optimized visiting order
    ordered_stops, optimized_distance = optimize_road_route(
        distance_matrix,
        stops,
    )

    # Map optimized stops to matrix indices
    stop_indices = [
        next(
            i + 1
            for i, stop in enumerate(stops)
            if stop is ordered_stop
        )
        for ordered_stop in ordered_stops
    ]

    # Calculate total travel time
    total_travel_time = calculate_route_time(
        duration_matrix,
        stop_indices,
    )

    # Get route geometry for map display
    geometry_data = get_road_route_geometry(
        depot,
        ordered_stops,
    )

    distance_saved = round(
        baseline_distance - optimized_distance,
        2,
    )

    reduction_percent = (
        round((distance_saved / baseline_distance) * 100, 2)
        if baseline_distance > 0
        else None
    )

    return {
        "ordered_stops": ordered_stops,
        "total_distance_km": optimized_distance,
        "baseline_distance_km": baseline_distance,
        "optimized_distance_km": optimized_distance,
        "distance_saved_km": distance_saved,
        "distance_reduction_percent": reduction_percent,
        "total_travel_time_min": total_travel_time,
        "number_of_stops": len(ordered_stops),
        "route_geometry": geometry_data["route_geometry"],
        "geometry_distance_km": geometry_data["geometry_distance_km"],
        "geometry_duration_min": geometry_data["geometry_duration_min"],
        "geometry_source": geometry_data["geometry_source"],
        "source": road_data["source"],
        "status": "success",
    }
