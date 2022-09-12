const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "goodreads.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

//writing middleware logger function

const logger = (request, response, next) => {
  console.log(request.query);
  //after the logger api handler is to be executed
  //for that we need to call next()
  next();
};

//writing middleware authenticate token function

const authenticateToken = (request, response, next) => {
  //Get Books API
  //specify logger function
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        //if token is successful then call api handler
        //console.log(payload);
        //now we want to send this payload/username, we can't send it directly
        //so we are sending it through request object
        request.username = payload.username;
        //we have to make use of this in user profile details handler
        next();
      }
    });
  }
};
//Get book API
app.get("/books/", authenticateToken, async (request, response) => {
  console.log("GET Book API");
  const getBooksQuery = `SELECT * FROM 
    book ORDER BY 
    book_id;`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

//Get Book API
app.get("/books/:bookId/", async (request, response) => {
  const { bookId } = request.params;
  const getBooksQuery = `
            SELECT
              *
            FROM
             book
            ORDER BY
             book_id;`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

//User Register API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    await db.run(createUserQuery);
    response.send(`User created successfully`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

//GET User profile API
app.get("/profile/", authenticateToken, async (request, response) => {
  //user name is stored in paylod while authenticating
  //fetching username through object destructuring
  let { username } = request;
  console.log(username);
  const selectUserQuery = `SELECT * FROM 
  user WHERE username='${username}';`;
  const userDetails = await db.get(selectUserQuery);
  response.send(userDetails);
});
