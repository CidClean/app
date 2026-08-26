import os
import pytest
import requests
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to grab public backend URL
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ["EXPO_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "Suarezmaiky25@gmail.com"
ADMIN_PASSWORD = "Miguel2026!"


@pytest.fixture(scope="session")
def api_base():
    return API


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client):
    r = api_client.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    return token


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def next_sunday_str():
    today = date.today()
    # weekday: Mon=0..Sun=6 -> days until Sunday
    days_ahead = (6 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7  # ensure future Sunday, not today
    target = today + timedelta(days=days_ahead)
    return target.strftime("%Y-%m-%d")


@pytest.fixture(scope="session")
def next_monday_str():
    today = date.today()
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
