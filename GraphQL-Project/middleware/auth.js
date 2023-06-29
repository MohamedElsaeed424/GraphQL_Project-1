const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  let authHeader = req.get("Authorization");
  //-----------------If i cant fetch the Autherization header from frontend------------------
  if (!authHeader) {
    req.isAuth = false;
    return next();
  }
  const token = authHeader.split(" ")[1];
  let decodedToken;
  //---------------------Varify the Token------------------------------------
  try {
    decodedToken = jwt.verify(token, "MY_SECRET_TOKEN_GENERATED");
  } catch (err) {
    req.isAuth = false;
    return next();
  }
  //-----------------Check if it exist---------------------------------------
  if (!decodedToken) {
    req.isAuth = false;
    return next();
  }
  req.userId = decodedToken.userId;
  req.isAuth = true;
  next();
};
