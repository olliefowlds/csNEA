import bcrypt

def hash(password: str):    # make sure they're strings so that it does'nt throw and error 
    password = password.encode('utf-8') # convert to a byte string for encoding 
    salt = bcrypt.gensalt() # generate a salt 
    hashedPassword = bcrypt.hashpw(password, salt)
    return hashedPassword

def checkPassword(guess: str, hash: str):
    guess = guess.encode('utf-8')
    return bcrypt.checkpw(guess, hash)

