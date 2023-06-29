const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Post = require("../models/post");
const { clearImage } = require("../util/deleteImage");

module.exports = {
  createUser: async function ({ userInput }, req) {
    try {
      //--------------------------Validation Errors-----------------------
      const errors = [];
      if (!validator.isEmail(userInput.email)) {
        errors.push({ message: "E-mail is Not Valid" });
      }
      if (
        validator.isEmpty(userInput.password) ||
        !validator.isLength(userInput.password, { min: 5 })
      ) {
        errors.push({ message: "Password Too short" });
      }
      if (errors.length > 0) {
        const error = new Error("Invalid Input");
        error.data = errors;
        error.code = 422;
        throw error;
      }
      //-----------------------------------------------------------------------------
      const existingUser = await User.findOne({ email: userInput.email });
      if (existingUser) {
        const error = new Error("User Exists Already");
        throw error;
      }
      const hashedPassword = await bcrypt.hash(userInput.password, 12);
      const user = new User({
        email: userInput.email,
        name: userInput.name,
        password: hashedPassword,
      });
      const createdUser = await user.save();
      return { ...createdUser._doc, _id: createdUser._id.toString() };
    } catch (err) {
      console.log(err);
    }
  },
  //-------------------------------------------------------------------------------------
  login: async function ({ email, password }, req) {
    try {
      const user = await User.findOne({ email: email });
      if (!user) {
        const error = new Error("This User Not Found");
        error.code = 404;
        throw error;
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        const error = new Error("Wrong Password");
        error.code = 401;
        throw error;
      }
      const token = jwt.sign(
        { email: user.email, userId: user._id.toString() },
        "MY_SECRET_TOKEN_GENERATED",
        { expiresIn: "1h" }
      );
      return { token: token, userId: user._id.toString() };
    } catch (err) {
      console.log(err);
    }
  },
  //-------------------------------------------------------------------------------------
  createPost: async function ({ postInput }, req) {
    try {
      if (!req.isAuth) {
        const error = new Error("Not Allowed to create Post");
        error.code = 401;
        throw error;
      }
      const errors = [];
      if (
        validator.isEmpty(postInput.title) ||
        !validator.isLength(postInput.title, { min: 5 })
      ) {
        errors.push({ message: "Title Too short" });
      }
      if (
        validator.isEmpty(postInput.content) ||
        !validator.isLength(postInput.content, { min: 5 })
      ) {
        errors.push({ message: "Content Too short" });
      }
      if (errors.length > 0) {
        const error = new Error("Invalid Input");
        error.data = errors;
        error.code = 422;
        throw error;
      }
      const user = await User.findById(req.userId);
      if (!user) {
        const error = new Error("Invalid User");
        error.code = 401;
        throw error;
      }
      const post = new Post({
        title: postInput.title,
        content: postInput.content,
        imageURL: postInput.imageURL,
        creator: user,
      });
      const createdPost = await post.save();
      user.posts.push(createdPost);
      await user.save();
      return {
        ...createdPost._doc,
        _id: createdPost._id.toString(),
        createdAt: createdPost.createdAt.toISOString(),
        updatedAt: createdPost.updatedAt.toISOString,
      };
    } catch (error) {
      console.log(error);
    }
  },
  //---------------------------------------------------------------------------------
  posts: async function ({ page }, req) {
    try {
      if (!req.isAuth) {
        const error = new Error("Not Autherized");
        error.code = 401;
        throw error;
      }
      if (!page) {
        page = 1;
      }
      const postPerPage = 2;
      const totalPosts = await Post.find().countDocuments();
      const posts = await Post.find()
        .populate("creator")
        .sort({ createdAt: -1 })
        .skip((page - 1) * postPerPage)
        .limit(postPerPage);
      return {
        posts: posts.map((post) => {
          return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString,
          };
        }),
        totalPosts: totalPosts,
      };
    } catch (error) {
      console.log(error);
    }
  },
  //---------------------------------------------------
  post: async function ({ id }, req) {
    try {
      if (!req.isAuth) {
        const error = new Error("Not Autherized");
        error.code = 401;
        throw error;
      }
      const post = Post.findById(id).populate("creator");
      if (!post) {
        const error = new Error("No Exixsting Post");
        error.code = 404;
        throw error;
      }
      return {
        ...post._doc,
        _id: post._id.toString(),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString,
      };
    } catch (error) {
      console.log(error);
    }
  },
  //-----------------------------------------------------------------
  updatePost: async function ({ id, postInput }, req) {
    try {
      if (!req.isAuth) {
        const error = new Error("Not Autherized");
        error.code = 401;
        throw error;
      }
      const errors = [];
      if (
        validator.isEmpty(postInput.title) ||
        !validator.isLength(postInput.title, { min: 5 })
      ) {
        errors.push({ message: "Title Too short" });
      }
      if (
        validator.isEmpty(postInput.content) ||
        !validator.isLength(postInput.content, { min: 5 })
      ) {
        errors.push({ message: "Content Too short" });
      }
      if (errors.length > 0) {
        const error = new Error("Invalid Input");
        error.data = errors;
        error.code = 422;
        throw error;
      }
      const post = await Post.findById(id).populate("creator");
      if (!post) {
        const error = new Error("No Post to be updated");
        error.code = 404;
        throw error;
      }
      if (post.creator._id.toString() !== req.userId.toString()) {
        const error = new Error("Not Autherized");
        error.code = 403;
        throw error;
      }
      (post.title = postInput.title), (post.content = postInput.content);
      if (postInput.imageURL !== "undefined") {
        post.imageURL = postInput.imageURL;
      }
      const updatedPost = await post.save();
      return {
        ...updatedPost._doc,
        _id: updatedPost._id.toString(),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString,
      };
    } catch (error) {
      console.log(error);
    }
  },
  //--------------------------------------------------------------
  deletePost: async function ({ id }, req) {
    try {
      if (!req.isAuth) {
        const error = new Error("Not Autherized");
        error.code = 401;
        throw error;
      }
      const post = await Post.findById(id);
      if (!post) {
        const error = new Error("Sorry , No post to be deleted");
        error.code = 404;
        throw error;
      }
      if (post.creator.toString() !== req.userId.toString()) {
        const error = new Error("You Are not allowed to Delete this Post");
        error.statusCode = 403;
        throw error;
      }
      clearImage(post.imageURL);
      const deltedpost = await Post.findByIdAndRemove(id);
      const user = await User.findById(req.userId);
      user.posts.pop(deltedpost);
      await user.save();
      return true;
    } catch (error) {
      console.log(error);
    }
  },
  //-----------------------------------------------------------------
  user: async function (args, req) {
    try {
      if (!req.isAuth) {
        const error = new Error("Not Autherized");
        error.code = 401;
        throw error;
      }
      const user = await User.findById(req.userId);
      if (!user) {
        const error = new Error("This User Not Found");
        error.code = 404;
        throw error;
      }
      return { ...user._doc, _id: user._id.toString() };
    } catch (error) {
      console.log(err);
    }
  },
  //-------------------------------------------------------------
  updateStatus: async function ({ status }, req) {
    try {
      if (!req.isAuth) {
        const error = new Error("Not Autherized");
        error.code = 401;
        throw error;
      }
      const user = await User.findById(req.userId);

      if (!user) {
        const error = new Error("This User Not Found");
        error.statusCode = 404;
        throw error;
      }
      user.status = newStatus;
      const updatedUser = await user.save();
      return { ...updatedUser._doc, _id: updatedUser._id.toString() };
    } catch (error) {
      console.log(error);
    }
  },
};
