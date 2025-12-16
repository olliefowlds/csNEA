from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import join_room, leave_room, SocketIO
from sqlalchemy import create_engine, text
from pythonFiles.models import GameManager, Game, Player
from pythonFiles.passwordEncryptor import hash, checkPassword
import random

# set up app
app = Flask(__name__)
app.config["SECRET_KEY"] = "olliesSuperSecretKey"
# set up sockets 
socketio = SocketIO(app, cors_allowed_origins="*")
# set up db
engine = create_engine('sqlite:///dartsDB.db', echo=False)
with engine.connect() as connection:
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS users (
            userID INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            currency INTEGER DEFAULT 0
        )
    """))
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS games (
            gameID INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATETIME DEFAULT (CURRENT_TIMESTAMP),
            wasCompleted BOOLEAN NOT NULL DEFAULT FALSE
        )
    """))
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS gameParticipants (
            gameID INTEGER NOT NULL,
            userID INTEGER NOT NULL,
            isWinner BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (gameID) REFERENCES games(gameID),
            FOREIGN KEY (userID) REFERENCES users(userID),
            PRIMARY KEY (gameID, userID)
        )
    """))
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS ownership (
            userID INTEGER NOT NULL,
            itemID INTEGER NOT NULL,
            FOREIGN KEY (userID) REFERENCES users(userID),
            FOREIGN KEY (itemID) REFERENCES shop(itemID),
            PRIMARY KEY (userID, itemID)
        )
    """))
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS shop (
            itemID INTEGER PRIMARY KEY AUTOINCREMENT,
            price INTEGER NOT NULL,
            type TEXT NOT NULL, 
            desc TEXT NOT NULL
        )
    """))
    connection.commit()
    
# init gameManager 
gameManager = GameManager()



# !!! LOGIN PAGE !!! 
@app.route('/', methods=['GET','POST'])
@app.route('/login', methods=['GET','POST'])
def login():
    if 'username' in session:
        return redirect(url_for('home'))
    message = None
    if request.method == 'POST':
        # get username and password
        username = request.form.get('username')
        password = request.form.get('password')

        with engine.connect() as connection: 
            user = None # set to none before search starts 
            # look for user with matching username and password
            user = connection.execute(text("SELECT * from users WHERE username = :username"), {"username": username}).fetchone()
            
            
            if user != None: # if user found 
                isCorrectPassword = checkPassword(password, user[2])
                if isCorrectPassword: 
                    session['username'] = username
                    message=f"Log in successful. Welcome back, {username}!"
                else:   # incorrect password 
                    message = "Incorrect username or password. Please try again."
            else:  # if no user found 
                message = "Incorrect username or password. Please try again."

    if 'username' in session: 
        return redirect(url_for('home'))

    return render_template('login.html', message=message)
# !!! END OF LOGIN PAGE !!!


# !!! REGISTER PAGE !!! 
@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'username' in session:
        return redirect(url_for('home'))
    message = None
    if request.method == 'POST':
        # get username and password
        username = request.form.get('username')
        password = request.form.get('password')
        hashedPassword = hash(password)

        #connect to db
        with engine.connect() as connection: 
            sameUsername = None # set to none before search starts 
            # check username not already taken
            sameUsername = connection.execute(text("SELECT * from users WHERE username = :username"), {"username": username}).fetchone()
            if sameUsername == None: 
                # if not taken, add new account to database
                connection.execute(
                    text("INSERT INTO users (username, password) VALUES (:username, :hashedPassword)"),{"username": username, "hashedPassword": hashedPassword})
                connection.commit()
                message=f"New user created. Welcome, {username}!"
                session['username'] = username
            else: 
                message="Username taken, sorry! Please enter a different one, or "

    if 'username' in session:
        return redirect(url_for('home'))
    return render_template('register.html', message=message)
# !!! END OF REGISTER PAGE !!!


# !!! HOME PAGE !!! 
def createNewGame(username):
    # 1 | get a unique game ROOM code (note this is different to gameID in db)
    loop = True
    while loop == True:
        gameCode = random.randint(1000,9999)
        if gameCode not in gameManager.games:
            loop = False
    
    # 2 | create new game object and add it to the game manager
    newGame = Game(gameCode)                
    gameManager.addGame(newGame)

    # 3 | add new field into tbl games in db 
    with engine.connect() as connection:
        connection.execute(text("INSERT INTO games DEFAULT VALUES"))
        connection.commit()

    # 4 | add new field into tbl gameParticipants in db, including the user who created the game. 
        userID = connection.execute(text('SELECT userID from users WHERE username = :username'), {'username':username}).fetchone()
        gameID = connection.execute(text('SELECT MAX(gameID) from games')).fetchone()
        connection.commit()

    # 5 | set game object's gameID 
    newGame.setGameID(int(gameID[0]))
    return gameCode

#game is created or joined here through HTML methods 
@app.route('/home', methods=['GET', 'POST'])
def home():
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']

    # if form is submitted, get data 
    if request.method == "POST":                                
        gameCode = request.form.get("gameCode")
        join = request.form.get("join", False)      #false is default 
        create = request.form.get("create", False)
        error = None 
        # validate all data inputted, check for like empty fields ... 
        if join != False and not gameCode:              #check if code is entered if they want to join a room 
            error = "Please enter a code."
        
        # if creating a room, create a new game
        elif create != False:               
            gameCode = createNewGame(username)

        # if they want to join a room, check if exists
        elif int(gameCode) not in gameManager.games:                             #else check if the room exists
            error = "Room does not exist."
        
        # check if the room they're joining is full
        elif gameManager.getGame(int(gameCode)).isFull() == True:
            error = "Room is full."

    
        if error != None:
            return render_template("home.html", error=error, gameCode=gameCode,username=username,user=session['username'])

        session["username"] = username      #store the user's name and room in the session
        session["gameCode"] = int(gameCode)
        
        return redirect(url_for("room", gameCode=gameCode))   #redirect to room page passing gameCode as argument 


    # default path
    return render_template('home.html', username=session['username'])

# !!! END OF HOME PAGE !!!


# !!! ROOM PAGE !!!
@app.route('/room/<int:gameCode>')
def room(gameCode):
    if 'username' not in session: 
        return redirect(url_for('login'))

    #get session data
    username = session.get('username')
    gameCode = session.get('gameCode')

    return render_template('room.html', gameCode=gameCode, username=username)

# socketio event once client connects
@socketio.on('joinRoom')
def joinRoom(data):
    gameCode = int(data['gameCode'])
    username = data['username']
    game = gameManager.getGame(gameCode)
    players = game.getPlayers()

    # check the join is valid 
    if gameCode not in gameManager.games or len(players) >= 2:
        return redirect(url_for('home'))
    else:
        # 1 | add player to the socketio room
        join_room(int(data['gameCode']))
        # rooms = socketio.server.rooms(request.sid)     # get all rooms the current SID is in 

        # 2 | Create a new player object and add to game object
        newPlayer = Player(username, request.sid)
        game.addPlayer(newPlayer)

        # 3 | add player to gameParticipants in db
        with engine.connect() as connection: 
            userID = connection.execute(text('SELECT userID from users WHERE username = :username'), {'username':username}).fetchone()
            gameID = game.getGameID()
            connection.execute(text("INSERT INTO gameParticipants (gameID, userID) VALUES (:gameID, :userID)"), {'gameID':gameID, 'userID':userID[0]})
            connection.commit()

# begin game following button press
@socketio.on('startGame')
def startGame(data):
    gameCode = int(data['gameCode'])
    game = gameManager.getGame(int(data['gameCode']))
    players = game.getPlayers()
    playersList = list(players.values())
    
    if len(playersList) == 2:
        game.beginGame()

        player = playersList[0] 
        player1Info = f"{player.getUsername()}: {player.getScore()}"
        player = playersList[1] 
        player2Info = f"{player.getUsername()}: {player.getScore()}"
        playerTurn = game.getPlayerTurn()
        usernameTurn = game.getPlayer(playerTurn).getUsername()
        socketio.emit('beginGameFrontEnd', {'player1Info':player1Info, 'player2Info':player2Info, 'playerTurn':usernameTurn}, to=gameCode)
        socketio.emit('enableThrow', {}, to=playerTurn)
    else:
        socketio.emit('clientError', {'errorMessage': 'Not enough players to start the game!'}, to=request.sid)

# show throw on other user screen
@socketio.on('sendThrowForOtherUser')
def handleThrowForOtherUser(data):
    # get non player turn SID
    gameCode = int(data['gameCode'])
    game = gameManager.getGame(gameCode)
    playerTurn = game.getPlayerTurn()
    players = game.getPlayers()
    for sid in players: 
        if sid != playerTurn: 
            nonPlayerSID = sid

    socketio.emit('receiveOtherUserThrow', {'target': data['target']}, to=nonPlayerSID)

# receive score and update 
@socketio.on('sendScore')
def handleScore(data):
    # this function is called once a throw has been made, and score sent. 
    # if in game, the game object will be updated; then check for game over, if so find the winner

    # get info 
    gameCode = int(data['gameCode'])
    game = gameManager.getGame(gameCode)
    players = game.getPlayers()                     
    playersList = list(players.values())
    player1 = playersList[0] 
    player2 = playersList[1] 

    if game.getGameState() == "inProgress": #if game inProgress, try submit the score
        
        score = int(data['score'])
        senderSID = request.sid
        isDouble = data['isDouble']
        game.recordThrow(senderSID, score, isDouble)        # record throw into game object
        
        # prepare info to send as emit

        player1Info = f"{player1.getUsername()}: {player1.getScore()}"
        player2Info = f"{player2.getUsername()}: {player2.getScore()}"
        playerTurn = game.getPlayerTurn()
        usernameTurn = game.getPlayer(playerTurn).getUsername()

        socketio.emit('scoreUpdate', {'player1Info':player1Info, 'player2Info':player2Info, 'playerTurn':usernameTurn}, to=gameCode)
        socketio.emit('enableDartResetPosBtn', {}, to=playerTurn)

    if game.getGameState() == 'gameOver': #if game over, find winner, update db, and terminate 
        # 1 | find winner : 
        if player1.getScore() == 0:
            winner = player1
            loser = player2 
        else:
            winner = player2
            loser = player1 

        # 2 | update games to set wasCompleted to true, and set winner in gameParticipants. 
        gameID = game.getGameID()
        with engine.connect() as connection:
            connection.execute(text("UPDATE games SET wasCompleted = TRUE WHERE gameID = :gameID"), {'gameID':gameID})
            winnerID = connection.execute(text("SELECT userID from users WHERE username = :username"), {'username': winner.getUsername()}).fetchone()[0]
            connection.execute(text("UPDATE gameParticipants SET isWinner = TRUE WHERE gameID = :gameID AND userID = :userID"), {'gameID': gameID, 'userID': winnerID})
            loserID = connection.execute(text("SELECT userID from users WHERE username = :username"), {'username': loser.getUsername()}).fetchone()[0]
            connection.execute(text("UPDATE gameParticipants SET isWinner = FALSE WHERE gameID = :gameID AND userID = :userID"), {'gameID': gameID, 'userID': loserID})
            connection.commit()

        # 3 | give currecny
            connection.execute(text("UPDATE users SET currency = currency + 200 WHERE userID = :userID"), {'userID': winnerID})
            connection.execute(text("UPDATE users SET currency = currency + 100 WHERE userID = :userID"), {'userID': loserID})

        # 4 | emit errorMessage (saying game over) and terminateGame
        socketio.emit('clientError', {'errorMessage': f'Game Over! {winner.getUsername()} wins!'}, to=gameCode)
        socketio.emit('terminateGame', {'winner':winner.getUsername()}, to=gameCode)
        gameManager.terminateGame(gameCode)

# when player 1 resets dart pos, reset player 2's aswell 
@socketio.on('resetDartPos')
def resetDartPos(data):
    socketio.emit('resetDartPosForOtherUser', {}, to=int(data['gameCode']))

# !!! END OF ROOM PAGE !!!


# !!! STATS PAGE !!!
@app.route('/statistics', methods=['GET', 'POST'])
def stats():
    #check logged in
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']

    #get the desired rank: default is by wins 
    rankBy = 'wins'
    if request.method == 'POST':
        rankBy = request.form.get('rankBy')

    with engine.connect() as connection:
    # find total number of games played
        playedGamesArr = connection.execute(
            text("""
                SELECT gp.gameID
                FROM gameParticipants gp
                JOIN users u ON u.userID = gp.userID
                JOIN games g ON g.gameID = gp.gameID
                WHERE g.wasCompleted = TRUE AND u.username = :username
            """),
            {'username': username}
        ).fetchall()

    # find total number of wins
        wonGamesArr = connection.execute(
            text("""
                SELECT gp.gameID
                FROM gameParticipants gp
                JOIN users u ON u.userID = gp.userID
                JOIN games g ON g.gameID = gp.gameID
                WHERE g.wasCompleted = TRUE AND u.username = :username AND gp.isWinner = TRUE
            """),
            {'username': username}
        ).fetchall()

    # find desired global stats 
        if rankBy == 'wins':
            globalRank = connection.execute(
                text("""
                    SELECT RANK() OVER (ORDER BY COUNT(g.gameID) DESC), u.username, COUNT(g.gameID)
                    FROM gameParticipants gp
                    JOIN users u ON u.userID = gp.userID
                    JOIN games g ON g.gameID = gp.gameID
                    WHERE gp.isWinner = TRUE AND g.wasCompleted = TRUE
                    GROUP BY u.userID, u.username
                    ORDER BY COUNT(g.gameID) DESC
                    """)
            ).fetchall()
        elif rankBy == 'gamesPlayed':
            globalRank = connection.execute(
                text("""
                    SELECT RANK() OVER (ORDER BY COUNT(g.gameID) DESC), u.username, COUNT(g.gameID)
                    FROM gameParticipants gp
                    JOIN users u ON u.userID = gp.userID
                    JOIN games g ON g.gameID = gp.gameID
                    WHERE g.wasCompleted = TRUE
                    GROUP BY u.userID, u.username
                    ORDER BY COUNT(g.gameID) DESC
                    """)
            ).fetchall()
    # pack player stats into dict
    playerStats = {
        'totalGamesPlayed': len(playedGamesArr),
        'totalGamesWon': len(wonGamesArr)
    }
    globalStats = {'rankBy': rankBy, 'globalRank':globalRank}

    return render_template('stats.html', username=username, stats=playerStats, globalStats=globalStats)


# !!! END OF STATS PAGE !!!

# !!! SHOP PAGE !!!
@app.route('/shop', methods=["GET", "POST"])
def shop():
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']

    if request.method == "POST":
        # see what item was attempted to be purchased
        for key in request.form.keys():
            itemID = key

            if makePurchase(username, itemID): 
                print("purchase successful")
            else: print("purchase failed")

        
        dataToSend = {}

    dataToSend = {}
    with engine.connect() as connection:
        # 0 | get user currency 
        userCurrency = connection.execute(text('SELECT currency from users WHERE username = :username'), {'username':username}).fetchone()[0]
        dataToSend["currency"] = userCurrency


        # 1 | get all tags
        queryResult = connection.execute(text('SELECT itemID, "desc", price FROM shop WHERE type = "tag" ORDER BY itemID')).fetchall()
        #       -> convert to dicts for json
        tags = [{"itemID": row[0],  "desc": row[1], "price": row[2], "purchased":False} for row in queryResult]
        #       -> add to dataToSend
        dataToSend["tags"] = tags

        # 2 | get all (ITEM TYPE TWO)


        # 3 | see what items are owned
        userID = connection.execute(text('SELECT userID from users WHERE username = :username'), {'username':username}).fetchone()[0]
        purchasedQuery = connection.execute(text('SELECT itemID from ownership WHERE userID = :userID'), {'userID':userID}).fetchall()
        ownedIDs = [row[0] for row in purchasedQuery]

        for item in dataToSend["tags"]:
            if item["itemID"] in ownedIDs:
                item["purchased"] = True


        connection.commit()



    return render_template("shop.html", dataToSend=dataToSend, username=username)

def makePurchase(username, itemID):
    # see if possible to purchase
    with engine.connect() as connection:
        userID, currency = connection.execute(text('SELECT userID , currency from users WHERE username = :username'), {'username':username}).fetchone()
        itemPrice = connection.execute(text('SELECT price from shop WHERE itemID = itemID'), {'itemID':itemID}).fetchone()[0]
        success = False
        if currency >= itemPrice:
            # can purchase 

            # check not already purchased (will only occur if page refreshed)
            alreadyOwned = connection.execute(text('SELECT * from ownership WHERE userID = :userID AND itemID = :itemID'), {'userID': userID, 'itemID': itemID}).fetchone()
            if alreadyOwned == None: 
                currency -= itemPrice
                connection.execute(text('UPDATE users SET currency = :currency WHERE userID = :userID'), {'currency':currency, 'userID':userID})
                connection.execute(text('INSERT INTO ownership VALUES (:userID, :itemID)'),{'userID':userID, 'itemID':itemID})
                success = True


        connection.commit()
    return success

# !!! END OF SHOP PAGE !!!


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))






# main 
if __name__ == "__main__":
    # socketio.run(app,host='192.168.0.233', port=5000, debug=True)
    socketio.run(app, debug=True)
