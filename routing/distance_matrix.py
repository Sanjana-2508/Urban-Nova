from routing.optimizer import calculate_distance


def build_distance_matrix(depot, stops):
    """
    Build a distance matrix in kilometres.

    The depot is represented by index 0.
    Collection stops are represented by indices 1, 2, 3, etc.
    """
    locations = [depot]

    for stop in stops:
        locations.append(
            (stop["latitude"], stop["longitude"])
        )

    matrix = []

    for location_a in locations:
        row = []

        for location_b in locations:
            distance = calculate_distance(location_a, location_b)
            row.append(round(distance, 2))

        matrix.append(row)

    return matrix
