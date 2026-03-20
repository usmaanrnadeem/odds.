"""
One-time script to create the first admin user and print a first invite token.
Run once against the live DB:

    python seed_admin.py

Reads .env for DB credentials (same as the main app).
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_USERNAME = os.getenv("SEED_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD")  # required — set in env or .env


async def main() -> None:
    if not ADMIN_PASSWORD:
        raise SystemExit(
            "Set SEED_ADMIN_PASSWORD in your environment or .env before running this script."
        )

    pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        ssl="require",
        min_size=1,
        max_size=2,
    )

    try:
        async with pool.acquire() as conn:
            # Check if admin already exists
            existing = await conn.fetchrow(
                "SELECT userid FROM users WHERE username = $1", ADMIN_USERNAME
            )
            if existing:
                print(f"Admin user '{ADMIN_USERNAME}' already exists (id={existing['userid']}).")
                admin_id = existing["userid"]
            else:
                hashed = pwd_ctx.hash(ADMIN_PASSWORD)
                admin_id = await conn.fetchval(
                    """
                    INSERT INTO users (username, password_hash, is_admin, token_key)
                    VALUES ($1, $2, TRUE, 'wizard')
                    RETURNING userid
                    """,
                    ADMIN_USERNAME, hashed,
                )
                print(f"Created admin user '{ADMIN_USERNAME}' (id={admin_id}).")

            # Generate a first invite token valid for 7 days
            token = str(uuid.uuid4())
            expires = datetime.now(timezone.utc) + timedelta(days=7)
            await conn.execute(
                """
                INSERT INTO invite_tokens (token, created_by, expires_at)
                VALUES ($1, $2, $3)
                """,
                token, admin_id, expires,
            )
            print(f"\nFirst invite token (valid 7 days):\n  {token}\n")
            print("Share this token with the first real user so they can register.")

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
