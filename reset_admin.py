import asyncio, asyncpg, os
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()
pwd = CryptContext(schemes=["bcrypt"])

NEW_PASSWORD = "admin123"

async def reset():
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT")),
        database=os.getenv("DB_NAME"), user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"), ssl="require",
    )
    h = pwd.hash(NEW_PASSWORD)
    await conn.execute(
        """
        INSERT INTO users (username, password_hash, is_admin)
        VALUES ('admin', $1, TRUE)
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = TRUE
        """,
        h,
    )
    await conn.close()
    print(f"Password reset to: {NEW_PASSWORD}")

asyncio.run(reset())
