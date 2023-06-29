const fs = require("fs");
const path = require("path");

const { validationResult } = require("express-validator/check");
const io = require("../socket");

const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = async (req, res, next) => {
  //-------------------------------------Bagination---------------------------------------
  const currentPage = req.query.page || 1;
  const postPerPage = 2;
  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate("creator")
      //--------------------------------sort posts based on created at in decending way------------------------
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * postPerPage)
      .limit(postPerPage);
    //-------------------------------------------------------------------------------------
    res.status(200).json({
      message: "Fetched All Posts Successfully",
      posts: posts,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const title = req.body.title;
  const content = req.body.content;
  const imageURL = req.file.path.replace("\\", "/");

  //---------------------------------Validations-----------------
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Please Enter Valid Title or Content");
    error.statusCode = 422;
    throw error;
  }
  //----------------------------------Check for Image Exist-------
  if (!imageURL) {
    const error = new Error("No image Provided");
    error.statusCode = 422;
    throw error;
  }
  //-------------------------------------------------------------
  const post = new Post({
    title: title,
    content: content,
    creator: req.userId,
    imageURL: imageURL,
  });
  try {
    await post.save();
    //-----------------------Pushing the post to posts of this user--------------------------------
    const user = await User.findById(req.userId);
    user.posts.push(post);
    await user.save();
    //---------------------informing other users with created posts----------------------------------------
    io.getIO().emit("posts", {
      action: "create",
      post: { ...post._doc, creator: { _id: req.userId, name: user.name } },
    });
    //-------------------------------------------------------------------------------------
    res.status(201).json({
      message: "Post Created Successfully",
      post: post,
      creator: { _id: user._id, name: user.name },
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error("Sorry,This Post Not Found");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ post: post });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  const postId = req.params.postId;
  //-------------------------------Validations----------------------------------
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Please Check for Updated Title or Content");
    error.statusCode = 424;
    throw error;
  }
  //----------------------------------------------------------------------------
  const title = req.body.title;
  const content = req.body.content;
  let imageURL = req.body.image;

  //----------------------------Image Validations------------------------------
  if (req.file) {
    imageURL = req.file.path.replace("\\", "/");
  }
  if (!imageURL) {
    const error = new Error("Missing an Image Here!");
    error.statusCode = 422;
    throw error;
  }
  //----------------------------------------------------------------------------
  try {
    const post = await Post.findById(postId).populate("creator");
    if (!post) {
      const error = new Error("Sorry, No Post to be Updated");
      error.statusCode = 404;
      throw error;
    }
    //------------------------------------Check if this is the user logged in or not from Token id in middleware file----------
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("You Are not allowed to Edit this Post");
      error.statusCode = 403;
      throw error;
    }
    //----------------If Uploaded a new Image not Like the old one so clear the old one using the heloper function i created-----------------------------------------------------------------
    if (imageURL !== post.imageURL) {
      clearImage(post.imageURL);
    }
    //--------------------------------------------------------------------------------------------------------------------
    post.title = title;
    post.content = content;
    post.imageURL = imageURL;
    const updatedPost = await post.save();
    //----------------------------------socket io to inform for updating---------------
    io.getIO().emit("posts", { action: "update", post: updatedPost });
    //----------------------------------------------------------------------------
    res
      .status(200)
      .json({ message: "Post Updated Successfully", post: updatedPost });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error("Sorry, No Post to be Deleted");
      error.statusCode = 404;
      throw error;
    }
    //------------------------------------Check if this is the user logged in or not from Token id in middleware file----------
    if (post.creator.toString() !== req.userId) {
      const error = new Error("You Are not allowed to Delete this Post");
      error.statusCode = 403;
      throw error;
    }
    clearImage(post.imageURL);

    post = await Post.findByIdAndRemove(postId);
    const user = await User.findById(req.userId);
    user.posts.pull(postId);
    await user.save();
    io.getIO().emit("posts", { action: "delete", post: postId });

    res.status(200).json({ message: "Post Deleted Successfully" });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => console.log(err));
};
