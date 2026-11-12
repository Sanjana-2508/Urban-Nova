from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_empty_stops_rejected():
    response = client.post(
        "/routes/optimize",
        json={
            "depot_latitude": 13.1007,
            "depot_longitude": 77.5963,
            "stops": []
        }
    )

    assert response.status_code == 422


def test_duplicate_stop_ids_rejected():
    response = client.post(
        "/routes/optimize",
        json={
            "depot_latitude": 13.1007,
            "depot_longitude": 77.5963,
            "stops": [
                {
                    "id": "1",
                    "name": "Collection Point A",
                    "latitude": 13.1050,
                    "longitude": 77.5940
                },
                {
                    "id": "1",
                    "name": "Collection Point B",
                    "latitude": 13.0960,
                    "longitude": 77.6020
                }
            ]
        }
    )

    assert response.status_code == 422


def test_invalid_depot_latitude_rejected():
    response = client.post(
        "/routes/optimize",
        json={
            "depot_latitude": 100,
            "depot_longitude": 77.5963,
            "stops": [
                {
                    "id": "1",
                    "name": "Collection Point A",
                    "latitude": 13.1050,
                    "longitude": 77.5940
                }
            ]
        }
    )

    assert response.status_code == 422