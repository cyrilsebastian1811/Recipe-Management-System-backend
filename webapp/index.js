const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.WEBAPP_PORT;

const api = require("./api");
const db = require("./db");

const tables = ["user", "recipe", "steps", "nutrition_information"];

const unless = function(routes, middleware) {
    return function(req, res, next) {
        if (req.path === "/" || routes.find(r => req.path.startsWith(r.path) && req.method === r.method)) {
            return next();
        } else {
            return middleware(req, res, next);
        }
    };
};

const createTables = () => new Promise(async (resolve, reject) => {
    try {
        for(let tableName of tables) {
            await db.createTableIfNotExists(tableName);
        }
        resolve();
    } catch(error) {
        reject(error);
    }
});

createTables().then(() => {
    app.use(unless([
        { path: "/v1/user", method: "POST" },
        { path: "/v1/recipe", method: "GET" }
    ], api.authorizeMiddleware));

    app.use(bodyParser.json());
    app.use(
        bodyParser.urlencoded({
            extended: true,
        })
    );

    app.get("/", (request, response) => {
        response.json({ info: "Node.js, Express, and Postgres API" });
    });
    app.post("/v1/user", api.createUser);
    app.get("/v1/user/self", api.getUserDetails);
    app.put("/v1/user/self",api.updateUserDetails);

    app.post("/v1/recipe", api.createRecipe);
    app.get("/v1/recipes", api.getLatestRecipe);
    app.get("/v1/recipe/:id", api.getRecipeDetails);
    app.delete("/v1/recipe/:id", api.deleteRecipe);
    app.put("/v1/recipe/:id", api.updateRecipe);

    app.listen(port, () => {
        console.log(`App running on port ${port}.`);
    })
}).catch(error => {
    console.error("Could not create tables. Application stopped.", error);
});

module.exports = app;