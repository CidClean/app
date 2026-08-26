from datetime import datetime, timedelta

import requests


def _service(api_base, api_client):
    services = api_client.get(f"{api_base}/services").json()
    return next(item for item in services if item["slug"] == "corte")


def _booking_payload(service, date_value, time_value, phone):
    return {
        "service_id": service["id"],
        "date": date_value,
        "time": time_value,
        "name": "TEST Phase One",
        "phone": phone,
        "address": "TEST Address 123",
        "neighborhood": "Viñedos",
        "note": "phase-one-contract",
        "accepted_policies": True,
        "accepted_privacy": True,
    }


def test_health_and_public_seed(api_base, api_client):
    health = api_client.get(f"{api_base}/health")
    assert health.status_code == 200
    assert health.json()["database"] == "connected"

    services = api_client.get(f"{api_base}/services")
    assert services.status_code == 200
    data = services.json()
    assert len(data) >= 5
    assert all("_id" not in item for item in data)
    assert all(item["active"] is True for item in data)


def test_privacy_notice_is_public_and_versioned(api_base, api_client):
    response = api_client.get(f"{api_base}/privacy-notice")
    assert response.status_code == 200
    body = response.json()
    assert body["version"]
    assert body["controller"] == "Miguel Ángel Suárez"
    assert "teléfono" in body["data"]
    assert body["purpose"]


def test_booking_requires_both_consents(api_base, api_client, next_sunday_str):
    service = _service(api_base, api_client)
    slots = api_client.get(
        f"{api_base}/available-slots",
        params={"service_id": service["id"], "date_str": next_sunday_str},
    ).json()["slots"]
    assert slots
    payload = _booking_payload(service, next_sunday_str, slots[0], "9998100001")
    payload["accepted_privacy"] = False
    response = api_client.post(f"{api_base}/bookings", json=payload)
    assert response.status_code == 400


def test_atomic_overlap_and_status_release(api_base, api_client, auth_headers, next_sunday_str):
    service = _service(api_base, api_client)
    slots = api_client.get(
        f"{api_base}/available-slots",
        params={"service_id": service["id"], "date_str": next_sunday_str},
    ).json()["slots"]
    assert len(slots) >= 2

    selected = slots[len(slots) // 2]
    payload = _booking_payload(service, next_sunday_str, selected, "9998100002")
    created = api_client.post(f"{api_base}/bookings", json=payload)
    assert created.status_code == 200, created.text
    booking = created.json()["booking"]
    assert booking["status"] == "pending_confirmation"
    assert booking["accepted_privacy"] is True
    assert booking["privacy_notice_version"]

    duplicate = api_client.post(f"{api_base}/bookings", json={**payload, "phone": "9998100003"})
    assert duplicate.status_code == 409

    hour, minute = map(int, selected.split(":"))
    overlapping_time = (datetime(2026, 1, 1, hour, minute) + timedelta(minutes=15)).strftime("%H:%M")
    overlapping = api_client.post(
        f"{api_base}/bookings",
        json={**payload, "time": overlapping_time, "phone": "9998100004"},
    )
    assert overlapping.status_code == 409

    cancelled = requests.put(
        f"{api_base}/admin/bookings/{booking['id']}/status",
        headers=auth_headers,
        json={"status": "cancelled", "note": "test cleanup"},
    )
    assert cancelled.status_code == 200, cancelled.text

    released = api_client.post(
        f"{api_base}/bookings",
        json={**payload, "phone": "9998100005"},
    )
    assert released.status_code == 200, released.text
    released_id = released.json()["booking"]["id"]
    cleanup = requests.put(
        f"{api_base}/admin/bookings/{released_id}/status",
        headers=auth_headers,
        json={"status": "cancelled", "note": "test cleanup"},
    )
    assert cleanup.status_code == 200
