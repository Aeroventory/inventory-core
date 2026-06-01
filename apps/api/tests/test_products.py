def auth_headers(client):
    response = client.post(
        "/auth/register",
        json={"username": "admin", "password": "secret-password", "role": "admin"},
    )
    assert response.status_code == 201

    response = client.post(
        "/auth/login", data={"username": "admin", "password": "secret-password"}
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_duplicate_product_sku_returns_conflict(client):
    headers = auth_headers(client)
    payload = {"name": "Ventilation Panel", "sku": "VENT-001", "value": 0}

    first_response = client.post("/products/", json=payload, headers=headers)
    duplicate_response = client.post(
        "/products/",
        json={**payload, "name": "Another Panel"},
        headers=headers,
    )

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == "SKU already exists"
