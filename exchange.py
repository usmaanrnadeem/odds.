import math
import sqlite3

con = sqlite3.connect("exchange.db")

con.row_factory = sqlite3.Row

cur = con.cursor()

users = []

class Position:
    def __init__(self, userID: int, marketID: int, yesPos: int, noPos: int):
        self.userID = userID
        self.marketID = marketID
        self.yesPos = yesPos
        self.noPos = noPos

class PositionStore:
    def __init__(self):
        self.rows = {}

    def contains(self, key: tuple):
        if key not in self.rows:
            return False
        else: 
            return True
    
    def get(self, userId: int, marketID: int):
        key = (userId, marketID)
        if key not in self.rows:
            self.rows[key] = Position(userId, marketID, 0, 0)
        return self.rows[key]
    
    def addPos(self, positionRow: Position, quantity: int, side: bool):
        if side == 1:
            positionRow.yesPos += quantity
        elif side == 0:
            positionRow.noPos += quantity

    def removePos(self, positionRow: Position, quantity: int, side: bool):
        if side == 1:
            if quantity > positionRow.yesPos:
                raise ValueError("Insufficient yes positions to sell")
            else:
                positionRow.yesPos -= quantity
        elif side == 0:
            if quantity > positionRow.noPos:
                raise ValueError("Insufficient no positions to sell")
            else:
                positionRow.noPos -= quantity

class User:
    def __init__(self, username: str, points: float=0):
        users.append(self) # can be removed once system refactored for local db
        self.username = username
        self.points = points
        cur.execute(
            "INSERT INTO users (username, points) VALUES (?,?)",
            (self.username,self.points)
        )
        con.commit()
        self.userID = cur.lastrowid

class Markets:
    def __init__(self, b: int, outstandingYes: int=0, outstandingNo: int=0):
        self.b = b
        self.outstandingYes = outstandingYes
        self.outstandingNo = outstandingNo
        cur.execute(
            "INSERT INTO markets (b, outstandingYes, outstandingNo) VALUES (?,?,?)",
            (self.b, self.outstandingYes, self.outstandingNo)
        )
        con.commit()
        self.marketID = cur.lastrowid

    def buy(self, user: User, quantity: int ,side: bool, ledger: PositionStore):
        cost = LMSRCostBuy(self.b, self.outstandingYes, self.outstandingNo, quantity, side)
        if user.points >= cost:
            if side == 1:
                user.points -= cost 
                ledger.addPos(ledger.get(user.userID,self.marketID), quantity, side)
                self.outstandingYes += quantity
            elif side == 0:
                user.points -= cost 
                ledger.addPos(ledger.get(user.userID,self.marketID), quantity, side)
                self.outstandingNo += quantity
            return
        else:
            raise ValueError

    def buyRewrite(self, userID: int, quantity: int, side: bool):
        cur.execute("SELECT b, outstandingYes, outstandingNo FROM markets WHERE marketID = ?",
                    (self.marketID, )
        )

        marketValues  = cur.fetchone()
        
        cost = LMSRCostBuy(marketValues["b"], marketValues["outstandingYes"], marketValues["outstandingNo"], quantity, side)

        cur.execute("SELECT * FROM users WHERE userID = ?",
                    (userID,)            
        )
        userRow = cur.fetchone()
        if userRow["points"] >= cost:
            if side == 1: 
                cur.execute("UPDATE users SET points = points - ? WHERE userID = ?",
                            (cost, userID)
                )

                cur.execute("SELECT * FROM positions WHERE userID = ? AND marketID = ?",
                            (userID, self.marketID)
                )
                
                pos = cur.fetchone()

                if pos:
                    cur.execute("UPDATE positions SET yesPos = yesPos + ? WHERE userID = ? AND marketID = ?",
                                (quantity, userID, self.marketID)
                )
                    
                else:
                    cur.execute("INSERT INTO positions (userID, marketID, yesPos, noPos) VALUES (?,?,?,?)",
                                (userID, self.marketID, quantity, 0)
                    )
                    
                cur.execute("UPDATE markets SET outstandingYes = outstandingYes + ? WHERE marketID = ?",
                            (quantity, self.marketID)
                )
            elif side == 0: 
                cur.execute("UPDATE users SET points = points - ? WHERE userID = ?",
                            (cost, userID)
                )
                cur.execute("SELECT * FROM positions WHERE userID = ? AND marketID = ?",
                            (userID, self.marketID)
                )
                
                pos = cur.fetchone()

                if pos:
                    cur.execute("UPDATE positions SET noPos = noPos + ? WHERE userID = ? AND marketID = ?",
                                (quantity, userID, self.marketID)
                )
                    
                else:
                    cur.execute("INSERT INTO positions (userID, marketID, yesPos, noPos) VALUES (?,?,?,?)",
                                (userID, self.marketID, 0, quantity)
                    )
                
                cur.execute("UPDATE markets SET outstandingNo = outstandingNo + ? WHERE marketID = ?",
                            (quantity, self.marketID)
                )
            con.commit()
            return
        else:
            return ValueError


    
    def sell(self, user: User, quantity: int, side: bool, ledger: PositionStore):
        cost = LMSRCostSell(self.b, self.outstandingYes, self.outstandingNo, quantity, side)
        if side == 1: 
            if ledger.get(user.userID, self.marketID).yesPos < quantity:
                raise ValueError
            else:
                user.points += cost
                ledger.removePos(ledger.get(user.userID, self.marketID), quantity, side)
                self.outstandingYes -= quantity

        if side == 0:
            if ledger.get(user.userID, self.marketID).noPos < quantity:
                raise ValueError
            else: 
                user.points += cost
                ledger.removePos(ledger.get(user.userID, self.marketID), quantity, side)
                self.outstandingNo -= quantity

    def sellRewrite(self, userID: int, quantity: int, side: bool):

        cur.execute("SELECT b, outstandingYes, outstandingNo FROM markets WHERE marketID = ?",
                    (self.marketID, )
        )

        marketValues  = cur.fetchone()
        
        cost = LMSRCostSell(marketValues["b"], marketValues["outstandingYes"], marketValues["outstandingNo"], quantity, side)

        cur.execute("SELECT * FROM positions WHERE userID = ? AND marketID = ?",
                            (userID, self.marketID)
                )
                
        pos = cur.fetchone()
        
        if side == 1:

            if pos: 

                if pos["yesPos"] < quantity:
                    raise ValueError
                
                else:

                    cur.execute("UPDATE users SET points = points + ? WHERE userID = ?",
                                (cost, userID))
                    
                    cur.execute("UPDATE positions SET yesPos = yesPos - ? WHERE userID = ? AND marketID = ?",
                                (quantity, userID, self.marketID))
                    
                    cur.execute("UPDATE markets SET outstandingYes = outstandingYes - ? WHERE marketID = ?",
                                (quantity, self.marketID))
            
            else:
                raise ValueError
            
            con.commit()
            return

        elif side == 0:

            if pos:

                if pos["noPos"] < quantity:
                    raise ValueError
                
                else:

                    cur.execute("UPDATE users SET points = points + ? WHERE userID = ?",
                                (cost, userID))
                    
                    cur.execute("UPDATE positions SET noPos = noPos - ? WHERE userID = ? AND marketID = ?",
                                (quantity, userID, self.marketID))
                    
                    cur.execute("UPDATE markets SET outstandingNo = outstandingNo - ? WHERE marketID = ?",
                                (quantity, self.marketID))
            
            else:
                raise ValueError
            
            con.commit()
            return


    def settlement(self, side: bool, ledger: PositionStore):
        for user in users:
            if ledger.contains((user.userID, self.marketID)):
                
                positions = ledger.get(user.userID, self.marketID)

                if side == 1:
                    user.points += positions.yesPos
                else:
                    user.points += positions.noPos

                positions.yesPos = 0
                positions.noPos = 0

        self.outstandingYes = 0
        self.outstandingNo = 0

    def settlementRewrite(self, side: bool):

        if side == 1:

            cur.execute("UPDATE users SET points = points + COALESCE((SELECT yesPos FROM positions WHERE positions.userID == users.userID AND marketID = ?), 0)",
                        (self.marketID, ))

        elif side == 0:

            cur.execute("UPDATE users SET points = points + COALESCE((SELECT noPos FROM positions WHERE positions.userID == users.userID AND marketID = ?), 0)",
                        (self.marketID, ))

        cur.execute("DELETE FROM positions WHERE marketID = ?",
                    (self.marketID, ))
        
        cur.execute("UPDATE markets SET outstandingYes = 0, outstandingNo = 0 WHERE marketID = ?",
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

Ledger = PositionStore()