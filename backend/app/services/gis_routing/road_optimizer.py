
def calculate_route_distance(distance_matrix, stop_indices):
    """Calculate road distance, including the return to depot."""
    current = 0
    total_distance = 0.0

    for next_index in stop_indices:
        distance = distance_matrix[current][next_index]

        if distance is None:
            raise ValueError("No road route is available between locations.")

        total_distance += distance
        current = next_index

    return_distance = distance_matrix[current][0]

    if return_distance is None:
        raise ValueError("No road route back to the depot is available.")

    total_distance += return_distance
    return round(total_distance, 2)


def optimize_road_route(distance_matrix, stops):
    """
    Optimize the route using Nearest Neighbour and 2-opt.
    Always compare against the original stop order.
    """
    if not stops:
        return [], 0.0

    number_of_stops = len(stops)

    # Original visiting order
    original_route = list(range(1, number_of_stops + 1))
    best_route = original_route[:]
    best_distance = calculate_route_distance(
        distance_matrix, best_route
    )

    # Generate a Nearest Neighbour route
    remaining = set(original_route)
    current = 0
    nearest_route = []

    while remaining:
        next_index = min(
            remaining,
            key=lambda index: (
                float("inf")
                if distance_matrix[current][index] is None
                else distance_matrix[current][index]
            )
        )

        if distance_matrix[current][next_index] is None:
            raise ValueError("No road route is available to a stop.")

        nearest_route.append(next_index)
        remaining.remove(next_index)
        current = next_index

    # Use the nearest-neighbour route if it improves the original
    nearest_distance = calculate_route_distance(
        distance_matrix, nearest_route
    )

    if nearest_distance < best_distance:
        best_route = nearest_route[:]
        best_distance = nearest_distance

    # Apply 2-opt to improve the current best route
    improved = True

    while improved:
        improved = False

        for i in range(number_of_stops - 1):
            for j in range(i + 1, number_of_stops):

                candidate = (
                    best_route[:i]
                    + best_route[i:j + 1][::-1]
                    + best_route[j + 1:]
                )

                candidate_distance = calculate_route_distance(
                    distance_matrix, candidate
                )

                if candidate_distance < best_distance - 0.001:
                    best_route = candidate
                    best_distance = candidate_distance
                    improved = True
                    break

            if improved:
                break

    ordered_stops = [
        stops[index - 1] for index in best_route
    ]

    return ordered_stops, round(best_distance, 2)


def calculate_route_time(duration_matrix, stop_indices):
    """
    Calculate total travel time, including return to depot.
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

    return_time = duration_matrix[current][0]

    if return_time is None:
        raise ValueError(
            "No travel-time data available for the return journey."
        )

    total_time += return_time
    return round(total_time, 2)
