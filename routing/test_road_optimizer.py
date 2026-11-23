from routing.road_routing import get_road_distance_matrix


def test_osrm_road_matrix():
    """
    Test the road-distance and travel-duration matrices
    returned by OSRM.
    """

    depot = (13.1007, 77.5963)

    stops = [
        {
            "id": "1",
            "name": "Collection Point A",
            "latitude": 13.1050,
            "longitude": 77.5940,
        },
        {
            "id": "2",
            "name": "Collection Point B",
            "latitude": 13.0960,
            "longitude": 77.6020,
        },
    ]

    result = get_road_distance_matrix(depot, stops)

    # Check that the response contains the expected fields
    assert "road_distance_matrix_km" in result
    assert "travel_duration_matrix_min" in result
    assert result["source"] == "OSRM_OpenStreetMap"

    # One depot and two stops should produce 3 x 3 matrices
    distance_matrix = result["road_distance_matrix_km"]
    duration_matrix = result["travel_duration_matrix_min"]

    assert len(distance_matrix) == 3
    assert len(duration_matrix) == 3

    for row in distance_matrix:
        assert len(row) == 3

    for row in duration_matrix:
        assert len(row) == 3