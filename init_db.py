import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()
con = psycopg2.connect(os.getenv("DATABASE_URL"))

cur = con.cursor()

cur.execute("CREATE TABLE IF NOT EXISTS users(userID INTEGER PRIMARY KEY, username TEXT, points REAL)")
cur.execute("CREATE TABLE IF NOT EXISTS markets(marketID INTEGER PRIMARY KEY, b REAL, outstandingYes INTEGER, outstandingNo INTEGER)")
cur.execute("CREATE TABLE IF NOT EXISTS positions(userID INTEGER, marketID INTEGER, yesPos INTEGER, noPos INTEGER, PRIMARY KEY (userID, marketID))")

con.commit()
con.close()