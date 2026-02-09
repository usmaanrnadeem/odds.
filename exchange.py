import math

class User:
    def __init__(self, userID: int, username: str, points: float=0, yesPos: int=0, noPos: int=0):
        self.userID = userID
        self.username = username
        self.points = points
        self.yesPos = yesPos
        self.noPos = noPos

class Markets:
    def __init__(self, marketID: int, b: int, outstandingYes: int=0, outstandingNo: int=0):
        self.marketID = marketID
        self.b = b
        self.outstandingYes = outstandingYes
        self.outstandingNo = outstandingNo
        self.AMM = AMM(marketID, "AMM")
        
    def buy(self, user: User, quantity: int ,side: bool):
        if side == 1: 
            cost = LMSRCost(self.b, self.outstandingYes + quantity, self.outstandingNo) - LMSRCost(self.b, self.outstandingYes, self.outstandingNo)
        elif side == 0:
            cost = LMSRCost(self.b, self.outstandingYes, self.outstandingNo + quantity) - LMSRCost(self.b, self.outstandingYes, self.outstandingNo)
        if user.points >= cost:
            user.points -= cost
            self.AMM.points += cost
            if side == 1:
                user.yesPos += quantity
                self.outstandingYes += quantity

            elif side == 0:
                user.noPos += quantity
                self.outstandingNo += quantity
            return
        else:
            return ValueError
    
    def sell(self, user: User, quantity: int, side: bool):
        if side == 1: 
            if user.yesPos < quantity:
                return ValueError
            else:
                cost = LMSRCost(self.b, self.outstandingYes, self.outstandingNo) - LMSRCost(self.b, self.outstandingYes - quantity, self.outstandingNo)
                user.points += cost
                user.yesPos -= quantity
                self.outstandingYes -= quantity
                self.AMM.points -= cost

        if side == 0:
            if user.noPos < quantity:
                return ValueError
            else: 
                cost = LMSRCost(self.b, self.outstandingYes, self.outstandingNo) - LMSRCost(self.b, self.outstandingYes, self.outstandingNo - quantity)
                user.points += cost
                user.noPos -= quantity
                self.outstandingNo -= quantity
                self.AMM.points -= cost

class AMM:
    def __init__(self, marketID: int, username: str, points: float=10000, yesPos: int=0, noPos: int=0):
        self.marketID = marketID
        self.username = username
        self.points = points

class ClearingHouse:
    def __init__(self, points: dict, username: str="Clearing House",):
        self.points = points
        self.username = username

def LMSRCurrentPrice(b: float, yesQuantity: int, noQuantity: int) -> float:

    # for stability, rather than directly using math.exp()
    x = yesQuantity / b
    y = noQuantity / b
    m = max(x,y) 

    expYes = math.exp(x - m)
    expNo = math.exp(y - m)

    return expYes / (expYes + expNo)

def LMSRCost(b: float, yesQuantity: int, noQuantity: int) -> float:
    
    # for stability, rather than directly using math.exp()
    x = yesQuantity / b
    y = noQuantity / b
    m = max(x,y) 

    expYes = math.exp(x - m)
    expNo = math.exp(y - m)

    return b * (m + math.log(expYes + expNo))