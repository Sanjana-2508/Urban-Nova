from routing.optimizer import optimize_route, calculate_distance
from routing.distance_matrix import build_distance_matrix
from routing.route_service import create_route

def test_calculate_distance():
    point1 = (12.9716, 77.5946)
    point2 = (12.9352, 77.6245)

    distance = calculate_distance(point1, point2)

    assert distance > 0
    assert distance < 10


def test_optimize_route():
    depot = (12.9716, 77.5946)

    stops = [
        {
            "name": "CSE Block",
            "latitude": 12.9750,
            "longitude": 77.6000
        },
        {
            "name": "Library",
            "latitude": 12.9680,
            "longitude": 77.5900
        },
        {
            "name": "Cafeteria",
            "latitude": 12.9800,
            "longitude": 77.6100
        }
    ]

    result = optimize_route(depot, stops)

    assert len(result["ordered_stops"]) == 3
    assert result["total_distance_km"] > 0


def test_empty_stops():
    depot = (12.9716, 77.5946)

    result = optimize_route(depot, [])

    assert result["ordered_stops"] == []
    assert result["total_distance_km"] == 0



from distance_matrix import build_distance_matrix


def test_build_distance_matrix():
    depot = (12.9716, 77.5946)

    stops = [
        {
            "name": "Library",
            "latitude": 12.9680,
            "longitude": 77.5900
        },
        {
            "name": "Cafeteria",
            "latitude": 12.9800,
            "longitude": 77.6100
        }
    ]

    matrix = build_distance_matrix(depot, stops)

    assert len(matrix) == 3
    assert all(len(row) == 3 for row in matrix)
    assert matrix[0][0] == 0
    assert matrix[1][1] == 0
    assert matrix[2][2] == 0
    assert matrix[0][1] > 0

def test_create_route():
    depot = (12.9716, 77.5946)

    stops = [
        {
            "name": "Library",
            "latitude": 12.9680,
            "longitude": 77.5900
        },
        {
            "name": "Cafeteria",
            "latitude": 12.9800,
            "longitude": 77.6100
        }
    ]

    result = create_route(depot, stops)

    assert result["status"] == "success"
    assert result["number_of_stops"] == 2
    assert len(result["ordered_stops"]) == 2
    assert result["total_distance_km"] > 0
    assert len(result["distance_matrix_km"]) == 3
