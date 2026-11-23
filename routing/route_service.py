from routing.road_routing import (
    get_road_distance_matrix,
    get_road_route_geometry,
)

from routing.road_optimizer import (
    optimize_road_route,
    calculate_route_distance,
    calculate_route_time,
)


def create_route(depot, stops):
    """
    Create an optimized waste-collection route.

    The route starts at the depot, visits all stops,
    and returns to the depot.
    """

    # Get road distances and estimated driving durations
    road_data = get_road_distance_matrix(depot, stops)

    distance_matrix = road_data["road_distance_matrix_km"]
    duration_matrix = road_data["travel_duration_matrix_min"]

    # Baseline: visit stops in their original input order
    baseline_indices = list(range(1, len(stops) + 1))

    baseline_distance = calculate_route_distance(
        distance_matrix,
        baseline_indices,
    )

    # Optimize the visiting order using road distances
    ordered_stops, optimized_distance = optimize_road_route(
        distance_matrix,
        stops,
    )

    # Convert optimized stop order into matrix indices
    stop_indices = [
        next(
            i + 1
            for i, stop in enumerate(stops)
            if stop is ordered_stop
        )
        for ordered_stop in ordered_stops
    ]

    # Calculate total travel time, including return to depot
    total_travel_time = calculate_route_time(
        duration_matrix,
        stop_indices,
    )

    # Get actual road-route geometry
    geometry_data = get_road_route_geometry(
        depot,
        ordered_stops,
    )

    # Calculate distance savings
    distance_saved = round(
        baseline_distance - optimized_distance,
        2,
    )

    # Calculate percentage reduction
    if baseline_distance > 0:
        reduction_percent = round(
            (distance_saved / baseline_distance) * 100,
            2,
        )
    else:
        reduction_percent = None

    # Return route details
    return {
        "ordered_stops": ordered_stops,

        # Distance information
        "total_distance_km": optimized_distance,
        "baseline_distance_km": baseline_distance,
        "optimized_distance_km": optimized_distance,
        "distance_saved_km": distance_saved,
        "distance_reduction_percent": reduction_percent,

        # Travel time from the distance matrix
        # Travel time calculated from the duration matrix
        "total_travel_time_min": total_travel_time,
        "matrix_travel_time_min": total_travel_time,

        # Number of stops
        "number_of_stops": len(ordered_stops),

        # Matrices
        "road_distance_matrix_km": distance_matrix,
        "distance_matrix_km": distance_matrix,
        "travel_duration_matrix_min": duration_matrix,

        # Route geometry for map display
        "route_geometry": geometry_data["route_geometry"],
        "geometry_distance_km": geometry_data["geometry_distance_km"],
        "geometry_duration_min": geometry_data["geometry_duration_min"],
        "geometry_source": geometry_data["geometry_source"],

        # Data source and status
        "source": road_data["source"],
        "status": "success",
    }