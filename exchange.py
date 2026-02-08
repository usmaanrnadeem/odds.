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

    def buy(self, user: User, quantity: int ,side: bool):
        if side == 1: 
            cost = LMSRCurrentPrice(self.b, self.outstandingYes + quantity, self.outstandingNo) - LMSRCurrentPrice(self.b, self.outstandingYes, self.outstandingNo)
        elif side == 0:
            cost = LMSRCurrentPrice(self.b, self.outstandingYes, self.outstandingNo + quantity) - LMSRCurrentPrice(self.b, self.outstandingYes, self.outstandingNo)
        if user.points >= cost:
            user.points -= cost
            if side == 1:
                user.yesPos += quantity
                self.outstandingYes += quantity

            elif side == 0:
                user.noPos += quantity
                self.outstandingNo += quantity
            return
        else:
            return ValueError
class AMM:
    def __init__(self, marketID: int, username: str, points: float=0, yesPos: int=0, noPos: int=0):
        self.marketID = marketID
        self.username = username
        self.points = points
        self.yesPos = yesPos
        self.noPos = noPos

class ClearingHouse:
    def __init__(self, points: dict, username: str="Clearing House",):
        self.points = points
        self.username=username

def LMSRCurrentPrice(b: float, yesQuantity: int, noQuantity: int) -> float:

    # for stability, rather than directly using math.exp()
    x = yesQuantity / b
    y = noQuantity / b
    m = max(x,y) 

    expYes = math.exp(x - m)
    expNo = math.exp(y - m)

    return expYes / (expYes + expNo)