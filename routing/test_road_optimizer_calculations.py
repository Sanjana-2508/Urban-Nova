
from routing.road_optimizer import (
    optimize_road_route,
    calculate_route_distance,
    calculate_route_time,
)


def test_route_distance_includes_return_to_depot():
    # Matrix index 0 = depot; 1 and 2 = collection points
    distance_matrix = [
        [0.0, 2.0, 5.0],
        [2.4, 0.0, 3.0],
        [5.5, 3.2, 0.0],
    ]

    # Visit point A, then point B, then return to depot
    distance = calculate_route_distance(distance_matrix, [1, 2])

    # Depot -> A = 2.0
    # A -> B = 3.0
    # B -> Depot = 5.5
    assert distance == 10.5


def test_route_time_includes_return_to_depot():
    duration_matrix = [
        [0.0, 4.0, 8.0],
        [5.0, 0.0, 6.0],
        [9.0, 7.0, 0.0],
    ]

    # Depot -> A -> B -> Depot
    travel_time = calculate_route_time(duration_matrix, [1, 2])

    # 4 + 6 + 9 = 19 minutes
    assert travel_time == 19.0


def test_optimizer_includes_return_to_depot():
    distance_matrix = [
        [0.0, 2.0, 5.0],
        [2.4, 0.0, 3.0],
        [5.5, 3.2, 0.0],
    ]

    stops = [
        {"id": "A", "name": "Point A"},
        {"id": "B", "name": "Point B"},
    ]

    ordered_stops, total_distance = optimize_road_route(
        distance_matrix, stops
    )

    assert len(ordered_stops) == 2
    assert total_distance == 10.5