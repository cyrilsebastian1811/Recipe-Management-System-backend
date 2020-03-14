const uuid = require("uuid");
const bcrypt = require("bcrypt");
const Joi = require('joi');
const lodash = require('lodash');
const formidable = require('formidable');
const redis = require("redis");
const redisSentinel = require("redis-sentinel-client")
const { promisify } = require("util");
const { createLogger, format, transports } = require('winston');
const saltRounds = 10;

const db = require("./db");
const s3 = require("./s3");

let redisClient = null;

const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.splat(),
        format.simple()
    ),
   transports: [
       new transports.Console()
   ]
});

if(process.env.ENVIRONMENT === "production") {
    logger.log({level: "info", message: "Using redis-sentinel-client"});
    redisClient = redisSentinel.createClient({
        host: process.env.REDIS_HOST,
        port: process.env.SENTINEL_PORT,
        masterOptions: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
        },
        master_auth_pass: process.env.REDIS_PASSWORD
    });
} else {
    logger.log({level: "info", message: "Using redis"});
    redisClient = redis.createClient({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
    });
}

const setRedisAsync = promisify(redisClient.set).bind(redisClient);
const getRedisAsync = promisify(redisClient.get).bind(redisClient);
const delRedisAsync = promisify(redisClient.del).bind(redisClient);


redisClient.on("error", (err) => {
    logger.error(err);
});

const checkPassword = (password) => {
    if(password.length <= 8) return false;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /\W/.test(password);
    if (hasUpperCase + hasLowerCase + hasNumbers + hasNonalphas < 3)
        return false;

    return true;
}

const checkEmail = (email) =>  (/[a-zA-Z0-9_\.\+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-\.]+/.test(email));

const authorizeMiddleware = async (req, res, next) => {
    // console.info("checking for authentication");
    const auth = req.get('Authorization');

    if(lodash.isEmpty(auth)) return res.sendStatus(401);

    const token = auth.split(' ')[1];

    const credentials = Buffer.from(token, 'base64').toString().split(':');

    const email = credentials[0];
    const password = credentials[1];

    if(!password || !email) return res.status(401).json("Unauthorized");

    const {rows: emails} = await db.getAllEmail();

    if(!emails.map(e => e.email).includes(email))  return res.status(401).json("Unauthorized");

    const {rows: users} = await db.getUserDetails(email);
    const result = await bcrypt.compare(password, users[0].password);

    if(result) {
        res.locals.email = email;
    } else {
        return res.status(401).json("Unauthorized");
    }

    // console.info("authentication successful");
    next();
}

const createUser = async (request, response) => {
    logger.info(`Create user with request body ${JSON.stringify(request.body)}`);

    const email = request.body.email;
    const firstname = request.body.firstname;
    const lastname = request.body.lastname;
    const password = request.body.password;

    if(!checkEmail(email)) return response.status(400).json("Email does not meet criteria");

    if(!checkPassword(password)) return response.status(400).json("Password does not meet criteria");

    const { rows } = await db.getAllEmail();
    const allEmails = rows.map(item => item.email);

    if(allEmails.includes(email)) return response.status(400).json("Email already exists");

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const now = new Date();
    const createUserInput = {
        id: uuid(),
        email,
        firstname,
        lastname,
        password:hashedPassword,
        account_created: now,
        account_updated: now,
    };

    await db.createUser(createUserInput);

    logger.info("create user successful");

    response.status(201).json({
        id: createUserInput.id,
        email,
        firstname,
        lastname,
        account_created: createUserInput.account_created,
        account_updated: createUserInput.account_updated,
    });
}

const getUserDetails = async (req, res) => {
    const email = res.locals.email;

    const {rows: [user]} = await db.getUserDetails(email);

    res.status(200).send({
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        account_created: user.account_created,
        account_updated: user.account_updated,
    });
}

const updateUserDetails = async (req, res) => {
    logger.info(`update user details for ${res.locals.email} with request body ${JSON.stringify(req.body)}`);
    const email = res.locals.email;

    const schema = {
        email: Joi.string().forbidden(),
        firstname: Joi.string().optional(),
        lastname: Joi.string().optional(),
        password: Joi.string().regex(/^[a-zA-Z0-9]{8,30}$/).optional(),
        account_created: Joi.date().forbidden(),
        account_updated: Joi.date().forbidden(),
    };

    const validationResult = Joi.validate(req.body, schema);


    if (validationResult.error || lodash.isEmpty(req.body)) return res.sendStatus(400);

    const {rows: [details]} = await db.getUserDetails(email);

    const now = new Date();

    const newFirstname = req.body.firstname ? req.body.firstname : details.firstname;
    const newLastname = req.body.lastname ? req.body.lastname : details.lastname;

    let hashedPassword;
    if (req.body.password) {
        hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
    }
    const newPassword = req.body.password ? hashedPassword : details.password;
    const updateUserDetailsInput = {
        email,
        newFirstname,
        newLastname,
        newPassword,
        account_updated: now,
    }

    logger.info(`user details updated`);

    db.updateUserDetails(updateUserDetailsInput).then(() => {
        res.sendStatus(204);
    });
}

const createRecipe = async (req, res) => {
    const email = res.locals.email;

    logger.info(`Create recipe request with body ${JSON.stringify(req.body)}`);

    const stepsSchema = Joi.object().keys({
        position: Joi.number().min(1).required(),
        items: Joi.string().required(),
    })

    const nutritionSchema = Joi.object().keys({
        calories: Joi.number().integer().required(),
        cholesterol_in_mg: Joi.number().required(),
        sodium_in_mg: Joi.number().integer().required(),
        carbohydrates_in_grams: Joi.number().required(),
        protein_in_grams: Joi.number().required(),
    }).required();

    const schema = {
        cook_time_in_min: Joi.number().multiple(5).required(),
        prep_time_in_min: Joi.number().multiple(5).required(),
        title: Joi.string().required(),
        cuisine: Joi.string().required(),
        servings: Joi.number().min(1).max(5).required(),
        ingredients: Joi.array().required(),
        steps: Joi.array().items(stepsSchema).required(),
        nutrition_information: nutritionSchema,
    };

    const { error } = Joi.validate(req.body, schema);

    if(error) return res.status(400).json(error.details[0].message);

    try{
        const {rows: [user]} = await db.getUserDetails(email);
        const now = new Date();

        const recipeInput = {
            id: uuid(),
            created_ts: now,
            updated_ts: now,
            author_id: user.id,
            cook_time_in_min: req.body.cook_time_in_min,
            prep_time_in_min: req.body.prep_time_in_min,
            total_time_in_min: req.body.cook_time_in_min + req.body.prep_time_in_min,
            title: req.body.title,
            cuisine: req.body.cuisine,
            servings: req.body.servings,
            ingredients: req.body.ingredients,
        }

        await db.createRecipe(recipeInput);

        for(const step of req.body.steps) {
            const stepInput = {
                id: uuid(),
                position: step.position,
                items: step.items,
                recipe_id: recipeInput.id,
            };

            await db.createRecipeStep(stepInput);
        }

        const nutritionInput = {
            id: uuid(),
            ...req.body.nutrition_information,
            recipeId: recipeInput.id,
        };

        await db.createRecipeNutritionInformation(nutritionInput);

        logger.info(`Create recipe successful. Recipe id ${recipeInput.id}`);

        // add to redis cache for 10 minutes
        await setRedisAsync(recipeInput.id, JSON.stringify({
            ...recipeInput,
            steps: req.body.steps,
            nutrition_information: req.body.nutrition_information
        }), "EX", 60 * 10);

        res.status(201).send({
            ...recipeInput,
            steps: req.body.steps,
            nutrition_information: req.body.nutrition_information,
        });
    } catch(err) {
        logger.error(err);
        res.sendStatus(500);
    }
}

const getLatestRecipe = async (req,res) => {
    const { rows } = await db.getAllRecipes();

    if(lodash.isEmpty(rows) || rows.length <=0 ) return res.sendStatus(404);

    const latestRecipe = rows[0];

    const {rows: recipeSteps} = await db.getRecipeSteps(latestRecipe.id);
    const {rows: recipeNutritionInformation} = await db.getRecipeNutritionInformation(latestRecipe.id);

    res.status(200).send({
        id: latestRecipe.id,
        created_ts: latestRecipe.created_ts,
        updated_ts: latestRecipe.updated_ts,
        author_id: latestRecipe.author_id,
        cook_time_in_min: latestRecipe.cook_time_in_min,
        prep_time_in_min: latestRecipe.prep_time_in_min,
        total_time_in_min: latestRecipe.total_time_in_min,
        title: latestRecipe.title,
        cuisine: latestRecipe.cuisine,
        servings: latestRecipe.servings,
        ingredients: latestRecipe.ingredients,
        steps: recipeSteps.map(item => ({
            position: item.position,
            items: item.items
        })),
        nutrition_information: recipeNutritionInformation.map(item =>({
            calories: item.calories,
            cholesterol_in_mg: item.cholesterol_in_mg,
            sodium_in_mg: item.sodium_in_mg,
            carbohydrates_in_grams: item.carbohydrates_in_grams,
            protein_in_grams: item.protein_in_grams
        }))[0]
    });
}

const getAllRecipes = async (req, res) => {
    const { rows } = await db.getAllRecipes();

    if(lodash.isEmpty(rows) || rows.length <=0 ) return res.sendStatus(404);

    const allRecipes = await Promise.all(rows.map(async recipe => {
        const {rows: recipeSteps} = await db.getRecipeSteps(recipe.id);
        const {rows: recipeNutritionInformation} = await db.getRecipeNutritionInformation(recipe.id);

        return {
            ...recipe,
            steps: recipeSteps.map(item => ({
                position: item.position,
                items: item.items
            })),
            nutrition_information: recipeNutritionInformation.map(item =>({
                calories: item.calories,
                cholesterol_in_mg: item.cholesterol_in_mg,
                sodium_in_mg: item.sodium_in_mg,
                carbohydrates_in_grams: item.carbohydrates_in_grams,
                protein_in_grams: item.protein_in_grams
            }))[0]
        }
    }));

    res.status(200).send(allRecipes);
}

const getRecipeDetails = async (req, res) => {
    const id = req.params.id;

    logger.info(`Fetch recipe for id ${id}`);

    const cachedRecipe = await getRedisAsync(id);
    const {rows: imageDetails} = await db.getAllImagesForRecipe(id);
    if(cachedRecipe !== null) {
        const responseObject = JSON.parse(cachedRecipe);
        return res.status(200).send({
            id: id,
            image: !lodash.isEmpty(imageDetails) && imageDetails.length > 0 ? {
                id: imageDetails[imageDetails.length -1].id,
                url: imageDetails[imageDetails.length -1].url,
            } : null,
            ...responseObject
        });
    }

    const {rows: recipeDetails} = await db.getRecipeDetails(id);
    const {rows: recipeSteps} = await db.getRecipeSteps(id);
    const {rows: recipeNutritionInformation} = await db.getRecipeNutritionInformation(id);

    if(lodash.isEmpty(recipeDetails)) return res.sendStatus(404);

    const recipe = recipeDetails[0];

    const recipeObject = {
        id: recipe.id,
        created_ts: recipe.created_ts,
        updated_ts: recipe.updated_ts,
        author_id: recipe.author_id,
        cook_time_in_min: recipe.cook_time_in_min,
        prep_time_in_min: recipe.prep_time_in_min,
        total_time_in_min: recipe.total_time_in_min,
        title: recipe.title,
        cuisine: recipe.cuisine,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        steps: recipeSteps.map(item => ({
            position: item.position,
            items: item.items
        })),
        nutrition_information: recipeNutritionInformation.map(item =>({
            calories: item.calories,
            cholesterol_in_mg: item.cholesterol_in_mg,
            sodium_in_mg: item.sodium_in_mg,
            carbohydrates_in_grams: item.carbohydrates_in_grams,
            protein_in_grams: item.protein_in_grams
        }))[0]
    };

    if(cachedRecipe == null) {
        await setRedisAsync(id, JSON.stringify(recipeObject), "EX", 60 * 10);
    }

    logger.info(`Fetch recipe successful`);

    res.status(200).send({
        image: !lodash.isEmpty(imageDetails) && imageDetails.length > 0 ? {
            id: imageDetails[imageDetails.length -1].id,
            url: imageDetails[imageDetails.length -1].url,
        } : null,
        ...recipeObject
    });
}

const updateRecipe = async (req, res) => {
    const email = res.locals.email;
    const id = req.params.id;

    logger.info(`Update recipe ${id} with body ${JSON.stringify(req.body)}`);

    const stepsSchema = Joi.object().keys({
        position: Joi.number().min(1).required(),
        items: Joi.string().required(),
    })

    const nutritionSchema = Joi.object().keys({
        calories: Joi.number().integer().required(),
        cholesterol_in_mg: Joi.number().required(),
        sodium_in_mg: Joi.number().integer().required(),
        carbohydrates_in_grams: Joi.number().required(),
        protein_in_grams: Joi.number().required(),
    }).optional();

    const schema = {
        id: Joi.forbidden(),
        created_ts: Joi.forbidden(),
        updated_ts: Joi.forbidden(),
        author_id: Joi.forbidden(),
        cook_time_in_min: Joi.number().multiple(5).optional(),
        prep_time_in_min: Joi.number().multiple(5).optional(),
        title: Joi.string().optional(),
        cuisine: Joi.string().optional(),
        servings: Joi.number().min(1).max(5).optional(),
        ingredients: Joi.array().optional(),
        steps: Joi.array().items(stepsSchema).optional(),
        nutrition_information: nutritionSchema,
    };

    const {rows: [user]} = await db.getUserDetails(email);
    const {rows: recipeDetails} = await db.getRecipeDetails(id);

    if(lodash.isEmpty(recipeDetails)) return res.status(404).json("Not Found");

    if(user.id !== recipeDetails[0].author_id) return res.status(401).json("Unauthorized");

    if(lodash.isEmpty(req.body)) return res.status(400).json("Cannot send empty request object");

    const validationResult = Joi.validate(req.body, schema);

    if(validationResult.error) return res.status(400).json(validationResult.error.details[0].message);

    // delete key if present in the cache
    await delRedisAsync(id);

    const now = new Date();
    const recipe = recipeDetails[0];
    const newCookTime = req.body.cook_time_in_min ? req.body.cook_time_in_min : recipe.cook_time_in_min;
    const newPrepTime = req.body.prep_time_in_min ? req.body.prep_time_in_min : recipe.prep_time_in_min;
    const newTitle = req.body.title ? req.body.title : recipe.title;
    const newCuisine = req.body.cuisine ? req.body.cuisine : recipe.cuisine;
    const newServings = req.body.servings ? req.body.servings : recipe.servings;
    const newIngredients = req.body.ingredients ? req.body.ingredients : recipe.ingredients;

    const updateRecipeInput = {
        created_ts: recipe.created_ts,
        updated_ts: now,
        author_id: user.id,
        cook_time_in_min: newCookTime,
        prep_time_in_min: newPrepTime,
        total_time_in_min: newCookTime + newPrepTime,
        title: newTitle,
        cuisine: newCuisine,
        servings: newServings,
        ingredients: newIngredients
    }
    await db.updateRecipe(updateRecipeInput, id);

    if(req.body.steps) {
        await db.deleteRecipeOldSteps(id);

        for(const step of req.body.steps) {
            const stepInformation = {
                id: uuid(),
                position: step.position,
                items: step.items,
                recipe_id: id,
            };

            await db.createRecipeStep(stepInformation);
        }
    }

    if(req.body.nutrition_information) {
        await db.updateRecipeNutritionInformation(req.body.nutrition_information, id);
    }

    const {rows: [updatedRecipe]} = await db.getRecipeDetails(id);
    const {rows: recipeSteps} = await db.getRecipeSteps(id);
    const {rows: [nutritionInformation]} = await db.getRecipeNutritionInformation(id);

    const updatedRecipeObject = {
        ...updatedRecipe,
        steps: recipeSteps.map(step => ({
            items: step.items,
            position: step.position
        })),
        nutritionInformation: nutritionInformation
    };

    // set cache with the updated recipe
    setRedisAsync(id, JSON.stringify(updatedRecipeObject), "EX", 60 * 10);

    logger.info(`Update recipe successful for id ${id}`);

    res.status(200).send(updatedRecipeObject);
}

const deleteRecipe = async (req, res) => {
    const email = res.locals.email;
    const recipeId = req.params.id;

    logger.info(`Delete recipe with id ${recipeId}`);

    const {rows: [user]} = await db.getUserDetails(email);

    const {rows: recipeDetails} = await db.getRecipeDetails(recipeId);

    const {rows: imageDetails} = await db.getAllImagesForRecipe(recipeId);

    if(lodash.isEmpty(recipeDetails)) return res.sendStatus(404);

    if(user.id !== recipeDetails[0].author_id) return res.sendStatus(401);

    try {
        await delRedisAsync(recipeId);

        await db.deleteRecipe(recipeId);

        if(!lodash.isEmpty(imageDetails) && imageDetails.length > 0) {
            await Promise.all(imageDetails.map(async ({ url }) => {
                const urlPath = url.split("/");
                const s3Key = urlPath[urlPath.length - 1];
                await s3.deleteFile(s3Key);
            }));
        }

    } catch(err) {
        logger.error(err);
        return res.sendStatus(500);
    }

    logger.info("Delete recipe successful");
    res.sendStatus(204);
}

const createImage = async (req, res) => {
    const email = res.locals.email;
    const recipeId = req.params.id;

    const {rows: [user]} = await db.getUserDetails(email);
    const {rows: recipeDetails} = await db.getRecipeDetails(recipeId);

    if(lodash.isEmpty(recipeDetails)) return res.status(400).json("Recipe not found");

    const [recipe] = recipeDetails;

    if(recipe.author_id !== user.id) return res.status(400).json("User is not the author of this recipe");

    new formidable.IncomingForm().parse(req, async (err, fields, files) => {
        if (err) {
            logger.error('Error', err)
            throw err
        }

        for (const [key, file] of Object.entries(files)) {
            if(!(file.type === "image/jpeg" || file.type === "image/png")) return res.status(400).json("Uploaded file must be in jpeg or png format.")

            const fileSize = file.size;

            const s3Data = await s3.uploadFile(file);
            const imageInput = {
                id: uuid(),
                imageUrl: s3Data.Location,
                recipeId,
                md5: s3Data.ETag,
                size: fileSize,
            }
            try {
                await db.saveImageForRecipe(imageInput);
                res.status(201).json({
                    id: imageInput.id,
                    url: s3Data.Location,
                });
            }  catch(err) {
                logger.error(err);
                return res.status(400).json(err);
            }
        }
    })
}

const getImage = async (req, res) => {
    const recipeId = req.params.recipeId;
    const imageId = req.params.imageId;

    const {rows} = await db.getRecipeImage(recipeId, imageId);
    if(lodash.isEmpty(rows)) return res.status(404).json("Not Found");

    const [image] = rows;
    return res.status(200).json({
        id: image.id,
        url: image.url,
    });
}

const deleteRecipeImage = async (req,res) => {
    const recipeId = req.params.recipeId;
    const imageId = req.params.imageId;

    const {rows} = await db.getRecipeImage(recipeId, imageId);
    if(lodash.isEmpty(rows)) return res.status(404).json("Not Found");

    const [imageDetails] = rows;

    const urlPath = imageDetails.url.split("/");
    const s3Key = urlPath[urlPath.length - 1];

    try {
        const data = await s3.deleteFile(s3Key);
        // console.log(data);

        await db.deleteRecipeImage(recipeId, imageId);

        return res.status(204).json("No Content");
    } catch (err) {
        logger.error(err);
        return res.status(400).json("Bad Request");
    }
}

const testCache = async (req, res) => {
    const key = req.query.key;
    const val = req.query.val;

    await setRedisAsync(key, val, "EX", 60);
    const cachedValue = await getRedisAsync(key);

    return res.send({
       key: key,
       value: cachedValue
    });
}


module.exports = {
    authorizeMiddleware,
    createUser,
    getUserDetails,
    updateUserDetails,
    createRecipe,
    getRecipeDetails,
    deleteRecipe,
    updateRecipe,
    getLatestRecipe,
    getAllRecipes,
    createImage,
    deleteRecipeImage,
    getImage,
    testCache,
};



