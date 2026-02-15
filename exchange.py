import math

users = []

class User:
    def __init__(self, userID: int, username: str, yesPositions: dict[str, int] | None = None, noPositions: dict[str, int] | None = None, points: float=0):
        users.append(self)
        self.userID = userID
        self.username = username
        self.points = points
        self.yesPositions = {} if yesPositions is None else yesPositions
        self.noPositions = {} if noPositions is None else noPositions

class Markets:
    def __init__(self, marketID: int, b: int, outstandingYes: int=0, outstandingNo: int=0):
        self.marketID = marketID
        self.b = b
        self.outstandingYes = outstandingYes
        self.outstandingNo = outstandingNo
        
    def buy(self, user: User, quantity: int ,side: bool):
        cost = LMSRCostBuy(self.b, self.outstandingYes, self.outstandingNo, quantity, side)
        if user.points >= cost:
            if side == 1:
                if self.marketID not in user.yesPositions:
                    user.yesPositions[self.marketID] = 0
                user.points -= cost
                user.yesPositions[self.marketID] += quantity
                self.outstandingYes += quantity
            elif side == 0:
                if self.marketID not in user.noPositions:
                    user.noPositions[self.marketID] = 0
                user.points -= cost
                user.noPositions[self.marketID] += quantity
                self.outstandingNo += quantity
            return
        else:
            return ValueError
    
    def sell(self, user: User, quantity: int, side: bool):
        cost = LMSRCostSell(self.b, self.outstandingYes, self.outstandingNo, quantity, side)
        if side == 1: 
            if user.yesPositions.get(self.marketID,0) < quantity:
                return ValueError
            else:
                user.points += cost
                user.yesPositions[self.marketID] -= quantity
                self.outstandingYes -= quantity

        if side == 0:
            if user.noPositions.get(self.marketID,0) < quantity:
                return ValueError
            else: 
                user.points += cost
                user.noPositions[self.marketID] -= quantity
                self.outstandingNo -= quantity

    def settlement(self, side: bool):
        if side == 1:
            for user in users:
                if self.marketID in user.yesPositions:
                    user.points += user.yesPositions[self.marketID]
                    del user.yesPositions[self.marketID]
                user.noPositions.pop(self.marketID, None)
            self.outstandingYes = 0
            self.outstandingNo = 0
        if side == 0:
            for user in users:
                if self.marketID in user.noPositions:
                    user.points += user.noPositions[self.marketID]
                    del user.noPositions[self.marketID]
                user.yesPositions.pop(self.marketID)
            self.outstandingYes = 0
            self.outstandingNo = 0

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

    return b * ((m + math.log(expYes + expNo)) - (m + math.log(newExpYes + newExpNo)))

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

    return b * ((m + math.log(newExpYes + newExpNo)) - (m + math.log(expYes + expNo)))