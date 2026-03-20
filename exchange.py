import math
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import os

load_dotenv()

con = psycopg2.connect(os.getenv("DATABASE_URL"))

cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

class User:
    def __init__(self, username: str, points: float=0):
        self.username = username
        self.points = points
        cur.execute(
            "INSERT INTO users (username, points) VALUES (%s,%s) RETURNING userID",
            (self.username,self.points)
        )
        self.userID = cur.fetchone()["userID"]
        con.commit()

class Markets:
    def __init__(self, b: int, outstandingYes: int=0, outstandingNo: int=0):
        self.b = b
        self.outstandingYes = outstandingYes
        self.outstandingNo = outstandingNo
        cur.execute(
            "INSERT INTO markets (b, outstandingYes, outstandingNo) VALUES (%s,%s,%s) RETURNING marketID",
            (self.b, self.outstandingYes, self.outstandingNo)
        )
        self.marketID = cur.fetchone()["marketID"]
        con.commit()

    def buy(self, userID: int, quantity: int, side: bool):
        cur.execute("SELECT b, outstandingYes, outstandingNo FROM markets WHERE marketID = %s",
                    (self.marketID, )
        )

        marketValues  = cur.fetchone()
        
        cost = LMSRCostBuy(marketValues["b"], marketValues["outstandingYes"], marketValues["outstandingNo"], quantity, side)

        cur.execute("SELECT * FROM users WHERE userID = %s",
                    (userID,)            
        )
        userRow = cur.fetchone()
        if userRow["points"] >= cost:
            cur.execute("UPDATE users SET points = points - %s WHERE userID = %s",
                        (cost, userID)
            )

            cur.execute("SELECT * FROM positions WHERE userID = %s AND marketID = %s",
                        (userID, self.marketID)
            )
            
            pos = cur.fetchone()

            if side == 1: 

                if pos:
                    cur.execute("UPDATE positions SET yesPos = yesPos + %s WHERE userID = %s AND marketID = %s",
                                (quantity, userID, self.marketID)
                )
                    
                else:
                    cur.execute("INSERT INTO positions (userID, marketID, yesPos, noPos) VALUES (%s,%s,%s,%s)",
                                (userID, self.marketID, quantity, 0)
                    )
                    
                cur.execute("UPDATE markets SET outstandingYes = outstandingYes + %s WHERE marketID = %s",
                            (quantity, self.marketID)
                )
            elif side == 0: 

                if pos:
                    cur.execute("UPDATE positions SET noPos = noPos + %s WHERE userID = %s AND marketID = %s",
                                (quantity, userID, self.marketID)
                )
                    
                else:
                    cur.execute("INSERT INTO positions (userID, marketID, yesPos, noPos) VALUES (%s,%s,%s,%s)",
                                (userID, self.marketID, 0, quantity)
                    )
                
                cur.execute("UPDATE markets SET outstandingNo = outstandingNo + %s WHERE marketID = %s",
                            (quantity, self.marketID)
                )
            con.commit()
            return
        else:
            raise ValueError


    def sell(self, userID: int, quantity: int, side: bool):

        cur.execute("SELECT b, outstandingYes, outstandingNo FROM markets WHERE marketID = %s",
                    (self.marketID, )
        )

        marketValues  = cur.fetchone()
        
        cost = LMSRCostSell(marketValues["b"], marketValues["outstandingYes"], marketValues["outstandingNo"], quantity, side)

        cur.execute("SELECT * FROM positions WHERE userID = %s AND marketID = %s",
                            (userID, self.marketID)
                )
                
        pos = cur.fetchone()
        
        if pos:

            if side == 1:

               

                if pos["yesPos"] < quantity:
                    raise ValueError
                
                else:

                    cur.execute("UPDATE users SET points = points + %s WHERE userID = %s",
                                (cost, userID))
                    
                    cur.execute("UPDATE positions SET yesPos = yesPos - %s WHERE userID = %s AND marketID = %s",
                                (quantity, userID, self.marketID))
                    
                    cur.execute("UPDATE markets SET outstandingYes = outstandingYes - %s WHERE marketID = %s",
                                (quantity, self.marketID))
            
                con.commit()
                return

            elif side == 0:

                if pos["noPos"] < quantity:
                    raise ValueError
                
                else:

                    cur.execute("UPDATE users SET points = points + %s WHERE userID = %s",
                                (cost, userID))
                    
                    cur.execute("UPDATE positions SET noPos = noPos - %s WHERE userID = %s AND marketID = %s",
                                (quantity, userID, self.marketID))
                    
                    cur.execute("UPDATE markets SET outstandingNo = outstandingNo - %s WHERE marketID = %s",
                                (quantity, self.marketID))
                
                con.commit()
                return
            
        else:
            raise ValueError
                
    def settlement(self, side: bool):

        if side == 1:

            cur.execute("UPDATE users SET points = points + COALESCE((SELECT yesPos FROM positions WHERE positions.userID = users.userID AND marketID = %s), 0)",
                        (self.marketID, ))

        elif side == 0:

            cur.execute("UPDATE users SET points = points + COALESCE((SELECT noPos FROM positions WHERE positions.userID = users.userID AND marketID = %s), 0)",
                        (self.marketID, ))

        cur.execute("DELETE FROM positions WHERE marketID = %s",
                    (self.marketID, ))
        
        cur.execute("UPDATE markets SET outstandingYes = 0, outstandingNo = 0 WHERE marketID = %s",
                    (self.marketID, ))

        con.commit()

def LMSRCurrentPrice(b: float, yesQuantity: int, noQuantity: int) -> float:
    
    # not currently used, but will be useful in the future
    # for stability, rather than directly using math.exp()
    x = yesQuantity / b
    y = noQuantity / b
    m = max(x,y) 

    expYes = math.exp(x - m)
    expNo = math.exp(y - m)

    return expYes / (expYes + expNo)

def LMSRCostBuy (b: float, yesQuantity: int, noQuantity: int, purchaseQuantity: int, side: bool) -> float:

    x = yesQuantity / b
    y = noQuantity / b
    m = max(x,y) 

    expYes = math.exp(x - m)
    expNo = math.exp(y - m)

    if side == 1:
        newX = (yesQuantity + purchaseQuantity) / b
        newM = max(newX,y)

        newExpYes = math.exp(newX - newM)
        newExpNo = math.exp(y - newM)
    
    elif side == 0:
        newY = (noQuantity + purchaseQuantity) / b
        newM = max(x,newY)

        newExpYes = math.exp(x - newM)
        newExpNo = math.exp(newY - newM)

    return b * ((newM + math.log(newExpYes + newExpNo)) - (m + math.log(expYes + expNo)))

def LMSRCostSell (b: float, yesQuantity: int, noQuantity: int, saleQuantity: int, side: bool) -> float:

    x = yesQuantity / b
    y = noQuantity / b
    m = max(x,y) 

    expYes = math.exp(x - m)
    expNo = math.exp(y - m)

    if side == 1:
        newX = (yesQuantity - saleQuantity) / b
        newM = max(newX,y)

        newExpYes = math.exp(newX - newM)
        newExpNo = math.exp(y - newM)
    
    elif side == 0:
        newY = (noQuantity - saleQuantity) / b
        newM = max(x,newY)

        newExpYes = math.exp(x - newM)
        newExpNo = math.exp(newY - newM)

    return b * ((newM + math.log(newExpYes + newExpNo)) - (m + math.log(expYes + expNo)))