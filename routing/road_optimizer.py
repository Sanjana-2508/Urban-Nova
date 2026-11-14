
def optimize_road_route(distance_matrix, stops):
    """
    Optimize the visiting order using road distances.

    Matrix index 0 = depot.
    Matrix index 1 onwards = collection stops.
    """
    if not stops:
        return [], 0.0

    remaining = set(range(1, len(stops) + 1))
    current = 0  # Start at the depot
    ordered_stops = []
    total_distance = 0.0

    while remaining:
        # Choose the unvisited stop with the shortest road distance
        next_index = min(
            remaining,
            key=lambda index: (
                float("inf")
                if distance_matrix[current][index] is None
                else distance_matrix[current][index]
            )
        )

        distance = distance_matrix[current][next_index]

        if distance is None:
            raise ValueError(
                "No road route is available to one of the stops."
            )

        ordered_stops.append(stops[next_index - 1])
        total_distance += distance

        remaining.remove(next_index)
        current = next_index

    # Include the road distance from the final stop back to the depot
    return_distance = distance_matrix[current][0]

    if return_distance is None:
        raise ValueError("No road route back to the depot is available.")

    total_distance += return_distance

    return ordered_stops, round(total_distance, 2)



def calculate_route_distance(distance_matrix, stop_indices):
    """Calculate route distance, including the return to depot."""
    current = 0
    total_distance = 0.0

    for next_index in stop_indices:
        distance = distance_matrix[current][next_index]

        if distance is None:
            raise ValueError(
                "No road route is available between locations."
            )

        total_distance += distance
        current = next_index

    return_distance = distance_matrix[current][0]

    if return_distance is None:
        raise ValueError(
            "No road route back to the depot is available."
        )

    total_distance += return_distance
    return round(total_distance, 2)
def calculate_route_time(duration_matrix, stop_indices):
    """
    Calculate total travel time for a route,
    including the return to the depot.

    Matrix index 0 = depot.
    Matrix index 1 onwards = collection stops.
    Duration values are in minutes.
    """
    if not stop_indices:
        return 0.0

    current = 0
    total_time = 0.0

    for next_index in stop_indices:
        travel_time = duration_matrix[current][next_index]

        if travel_time is None:
            raise ValueError(
                "No travel-time data available between locations."
            )

        total_time += travel_time
        current = next_index

    # Include the journey back to the depot
    return_time = duration_matrix[current][0]

    if return_time is None:
        raise ValueError(
            "No travel-time data available for the return journey."
        )

    total_time += return_time

    return round(total_time, 2)