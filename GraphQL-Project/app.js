// hello this is mohamed
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { graphqlHTTP } = require("express-graphql");

const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const auth = require("./middleware/auth");
const { clearImage } = require("./util/deleteImage");

const app = express();

const MONGODB_URI =
  "mongodb+srv://Mohamed:205505@cluster0.um4hvor.mongodb.net/API-APP";

app.use(bodyParser.json());
//------------------------------Uploading images using multer--------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "images");
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4());
  },
});
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};
app.use(multer({ storage: storage, fileFilter: fileFilter }).single("image"));
// -----------------------------Storing images statically ------------------------
app.use("/images", express.static(path.join(__dirname, "images")));
//------------------------------------------------------------------------------------

//  to solve the problem of CORS (diffrent ports) we should set some headers while connecting with REACT APP
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type , Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use(auth);
app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    throw new Error("You are not Autherized");
  }
  if (!req.file) {
    return res.status(200).json({ message: "No File provided" });
  }
  if (req.body.oldPath) {
    clearImage(oldPath);
  }
  return res
    .status(201)
    .json({ message: "Filed Uploaded Successfully", path: req.file.path });
});

//----------------------------------------Setting The GraphQl-------------------------
app.use(
  "/graphql",
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    //--------------------------Graphiql is tool for testing my GraphQl logic-------------------------
    graphiql: true,
    //-----------------------------------------------------------------------------------------------
    customFormatErrorFn(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || "An Error Occured";
      const code = err.originalError.code || 500;
      return {
        message: message,
        data: data,
        status: code,
      };
    },
  })
);
//--------------------------------Gnenral Error handling ----------------------------

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

//-----------------------------using Socket.io connection with database----------------------------------------------------
mongoose
  .connect(MONGODB_URI)
  .then((result) => {
    app.listen(8080);
  })
  .catch((err) => console.log(err));
