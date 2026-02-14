import math

users = []

class User:
    def __init__(self, userID: int, username: str, yesPositions: dict[str, int]={}, noPositions: dict[str, int]={}, points: float=0):
        users.append(self)
        self.userID = userID
        self.username = username
        self.points = points
        self.yesPositions = yesPositions
        self.noPositions = noPositions

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
            if side == 1:
                if self.marketID in user.yesPositions:
                    user.points -= cost
                    self.AMM.points += cost
                    user.yesPositions[self.marketID] += quantity
                    self.outstandingYes += quantity
                else:
                    user.yesPositions[self.marketID] = 0
                    user.points -= cost
                    self.AMM.points += cost
                    user.yesPositions[self.marketID] += quantity
                    self.outstandingYes += quantity
            elif side == 0:
                if self.marketID in user.noPositions:
                    user.points -= cost
                    self.AMM.points += cost
                    user.noPositions[self.marketID] += quantity
                    self.outstandingNo += quantity
                else: 
                    user.noPositions[self.marketID] = 0
                    user.points -= cost
                    self.AMM.points += cost
                    user.noPositions[self.marketID] += quantity
                    self.outstandingNo += quantity
            return
        else:
            return ValueError
    
    def sell(self, user: User, quantity: int, side: bool):
        if side == 1: 
            if user.yesPositions.get(self.marketID,0) < quantity:
                return ValueError
            else:
                cost = LMSRCost(self.b, self.outstandingYes, self.outstandingNo) - LMSRCost(self.b, self.outstandingYes - quantity, self.outstandingNo)
                user.points += cost
                user.yesPositions[self.marketID] -= quantity
                self.outstandingYes -= quantity
                self.AMM.points -= cost

        if side == 0:
            if user.noPositions.get(self.marketID,0) < quantity:
                return ValueError
            else: 
                cost = LMSRCost(self.b, self.outstandingYes, self.outstandingNo) - LMSRCost(self.b, self.outstandingYes, self.outstandingNo - quantity)
                user.points += cost
                user.noPositions[self.marketID] -= quantity
                self.outstandingNo -= quantity
                self.AMM.points -= cost

    def settlement(self, user: User,side: bool):
        if side == 1:
            if self.marketID in user.yesPositions:
                user.points += user.yesPositions[self.marketID]
                del user.yesPositions[self.marketID]
            user.noPositions.pop(self.marketID, None)
            self.outstandingYes = 0
            self.outstandingNo = 0
        if side == 0:
            if self.marketID in user.noPositions:
                user.points += user.noPositions[self.marketID]
                del user.noPositions[self.marketID]
            user.yesPositions.pop(self.marketID)
            self.outstandingYes = 0
            self.outstandingNo = 0

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