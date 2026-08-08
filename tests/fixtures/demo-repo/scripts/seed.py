"""Seeds a couple of demo users into the fake in-memory auth service."""

import hashlib


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


class DemoUser:
    def __init__(self, email: str, password: str):
        self.email = email
        self.password_hash = hash_password(password)


def seed_demo_users():
    # TODO: replace with a real fixtures loader when the demo grows.
    return [
        DemoUser("ada@example.com", "hunter2"),
        DemoUser("grace@example.com", "correcthorse"),
    ]


if __name__ == "__main__":
    for user in seed_demo_users():
        print(f"seeded {user.email}")
