const express = require("express");
const app = express();

app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const validatePassword = (password) => {
  return password.length > 5;
};

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    username: dbObject.username,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,
  };
};

app.post("/register/", async (request, response) => {
  const { username, password, gender, name } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `INSERT INTO user(username,password,gender,name)
        VALUES('${username}','${hashedPassword}','${gender}','${name}');`;
    if (validatePassword(password)) {
      await db.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
}

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectUserTweetsQuery = `select * from user INNER JOIN tweet ON user.user_id = tweet.user_id  where tweet.user_id in (select following_user_id from follower where follower_user_id = (select user_id from user where username='${username}'));`;
  const tweets = await db.all(selectUserTweetsQuery);
  response.send(
    tweets.map((eachTweet) => convertStateDbObjectToResponseObject(eachTweet))
  );
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectedUserQuery = `select name from user where user_id in (select following_user_id from follower where follower_user_id = (select user_id from user where username='${username}'));`;
  const following_names = await db.all(selectedUserQuery);
  response.send(
    following_names.map((eachTweet) => {
      return {
        name: eachTweet.name,
      };
    })
  );
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectedUserQuery = `select name from user where user_id in (select follower_user_id from follower where following_user_id = (select user_id from user where username='${username}'));`;
  const followers_names = await db.all(selectedUserQuery);
  response.send(
    followers_names.map((eachTweet) => {
      return {
        name: eachTweet.name,
      };
    })
  );
});

module.exports = app;
