"""One-off rotation for credentials belonging to the seeded demo tenant.

Run manually from /app/backend:
    python rotate_demo_passwords.py

This script does not delete the tenant or its data. It prints each generated
password once so the owner can store it securely, then only stores bcrypt
hashes in MongoDB.
"""
import asyncio
import secrets
from datetime import datetime, timezone

from database import db
from security import hash_password


DEMO_TENANT_QUERY = {
    "$or": [
        {"source": "seed_demo"},
        {"code": "T001"},
        {"name": "GLOO Demo"},
    ]
}


async def rotate_demo_passwords() -> None:
    tenants = await db.tenants.find(DEMO_TENANT_QUERY, {"_id": 0, "id": 1, "code": 1, "name": 1}).to_list(100)
    if not tenants:
        print("No seeded demo tenant found; nothing changed.")
        return

    rotated = 0
    for tenant in tenants:
        users = await db.users.find(
            {"tenant_id": tenant["id"]},
            {"_id": 0, "id": 1, "email": 1, "name": 1},
        ).sort("email", 1).to_list(500)
        for user in users:
            new_password = secrets.token_urlsafe(24)
            await db.users.update_one(
                {"id": user["id"], "tenant_id": tenant["id"]},
                {"$set": {
                    "password_hash": hash_password(new_password),
                    "password_rotated_at": datetime.now(timezone.utc),
                }},
            )
            print(f"{tenant['code']} {user['email']}: {new_password}")
            rotated += 1

    print(f"Rotated {rotated} demo user password(s). Store the output securely; it will not be shown again.")


if __name__ == "__main__":
    asyncio.run(rotate_demo_passwords())
