class GameManager:
    def __init__(self):
        self.games = {}                 # gameCode : Game 
    
    def addGame(self, game): self.games[game.gameCode] = (game)

    def getGame(self, gameCode): return self.games[gameCode]
    


class Game:
    def __init__(self, gameCode):
        self.gameCode = gameCode
        self.gameID = None              # will be assigned once added in db 
        self.players = {}               # format: SID : Player
        self.gameState = "isReady"
        self.playerTurn = None          # SID of current player NOT THE PLAYER OBJECT 

    def getGameCode(self): return self.gameCode
    def getGameID(self): return self.gameID
    def getPlayers(self): return self.players
    def getPlayer(self, sid): return self.players[sid]
    def getGameState(self): return self.gameState
    def getPlayerTurn(self): return self.playerTurn

    def setGameID(self, gameID): 
        if self.gameID is None: #can only change gameID once 
            self.gameID = gameID
    def setGameState(self, state): self.gameState = state
    def setPlayerTurn(self, sid): self.playerTurn = sid

    def isFull(self):
        if len(self.getPlayers()) == 2:
            return True
        return False

    def addPlayer(self, player):
        if not(len(self.players) >= 2):
            self.players[player.sid] = player
    
    def removePlayer(self, sid):
        self.players.pop(sid)

    def playerRefresh(self, newSID, username):
        # find and remove current player stored 
        try:
            for oldSID in self.getPlayers():
                if self.getPlayer(oldSID).getUsername() == username: 
                    print('match')

                    clonedPlayer = Player(username, newSID)
                    clonedPlayer.score = self.getPlayer(oldSID).getScore()
                    clonedPlayer.dartsThrown = self.getPlayer(oldSID).getDartsThrown()
                    self.removePlayer(oldSID)
                    self.addPlayer(clonedPlayer)
        except: 
            # once player swapped, an error is thrown since the keys in self.getPlayers() is updated.
            return

                


    def beginGame(self):
        if self.getGameState() != "isReady": return

        self.setGameState("inProgress")
        for player in self.getPlayers().values():                # set every player's score to 501 
            player.score = 501
        self.setPlayerTurn( list(self.getPlayers().keys())[0] )      # set first player's turn to be the first player in the dict

    def recordThrow(self, sid, score, isDouble):
        player = self.getPlayers()[sid]
        dartsThrown = player.getDartsThrown()
        currentScore = player.getScore()
        
        # 1 | handle invalid turn throws 
        if dartsThrown >= 3 or sid != self.getPlayerTurn(): return
        
        # 2 | handle valid throws (in terms of who's throwing)
            # if go is a possible checkout
        if (currentScore - score == 0):
            if isDouble:
                currentScore -= score
            # if go is possible and is not checkout
        elif (currentScore - score > 1):
            currentScore -= score
            # if bust change turn (see step 4)

        # 3 | sort out player object 
        player.incrementDartsThrown()
        player.setScore(currentScore)

        # 4 | three darts thrown/ bust: reset and change turn 
        if player.getDartsThrown() >= 3 or (currentScore - score < 2):
            player.resetDartsThrown()

            # THIS WILL TRIP IF THERE ARE THREE PLAYRES IN A GAME OBJECT -- WHICH SHOULD NOT HAPPEN ANYWAYS REALLY
            players = self.getPlayers()
            for playerSID in players.keys():
                if playerSID != sid:
                    self.setPlayerTurn(playerSID)

        # 5 | check game state 
        self.checkForWin()

    def checkForWin(self):
        players = self.getPlayers()
        for player in players.values():
            if player.getScore() == 0:
                self.setGameState("gameOver")
                self.endGame()
                return True
        return False

    def endGame(self):
        if self.getGameState() != "gameOver": return
        print("Game Over")
        # ship off to database self.setGameState("archived")
        

    def __str__(self):
        return (f'Game: code {self.gameCode}, players {self.players}, state {self.gameState}, turn {self.playerTurn}')

class Player: 
    def __init__(self, username, sid):
        self.username = username
        self.score = 501
        self.sid = sid
        self.isReady = False
        self.dartsThrown = 0

    def getScore(self): return self.score
    def getSID(self): return self.sid
    def getUsername(self): return self.username
    def getDartsThrown(self): return self.dartsThrown

    def setScore(self, score): self.score = score
    def incrementDartsThrown(self): self.dartsThrown += 1
    def resetDartsThrown(self): self.dartsThrown = 0


if __name__ == "__main__": 


    #for tests
    gameManager = GameManager()
    
    newGame = Game("1234")
    gameManager.addGame(newGame)

    print(newGame.isFull())

    player1 = Player("Alice", "SID1")
    player2 = Player("Bob", "SID2")


    newGame.addPlayer(player1)
    newGame.addPlayer(player2)

    newGame.beginGame()

    print(newGame.isFull())

