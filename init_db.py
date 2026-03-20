import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

try:
    con = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )
    print("Connection successful")

    cur = con.cursor()

    cur.execute("CREATE TABLE IF NOT EXISTS users(userID INTEGER PRIMARY KEY, username TEXT, points REAL)")
    cur.execute("CREATE TABLE IF NOT EXISTS markets(marketID INTEGER PRIMARY KEY, b REAL, outstandingYes INTEGER, outstandingNo INTEGER)")
    cur.execute("CREATE TABLE IF NOT EXISTS positions(userID INTEGER, marketID INTEGER, yesPos INTEGER, noPos INTEGER, PRIMARY KEY (userID, marketID))")

    con.commit()
    con.close()

except Exception as e:
    print(f"Failed to connect: {e}")

