const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
require('dotenv').config()

const app = express();
const port = process.env.PORT

//Middleware Body-Parser
app.use(bodyParser.urlencoded({ extended: false }));

//settig view engine
app.set("view engine", "ejs");

//conneting to mongoDB
const conn = mongoose.createConnection(process.env.MONGOURI);
let gridfsBucket;

//initilizing gridfsBucket
conn.once("open", () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads",
  });
});

//making gridFsStorage
const storage = new GridFsStorage({
  url: process.env.MONGOURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      //generating random string
      crypto.randomBytes(16, (err, buff) => {
        if (err) {
          return reject(err);
        }
        //giving unique filenamem with extension
        const filename = buff.toString("hex") + path.extname(file.originalname);
        const fileinfo = {
          filename: filename,
          bucketName: "uploads",
        };
        resolve(fileinfo);
      });
    });
  },
});

const upload = multer({ storage });

// showing form to upload image
app.get("/", (req, res) => {
  res.render("index");
});

//showing user uploaded image retriveing from DB.
app.post("/post", upload.single("file"), (req, res) => {
  res.render("image", { src: req.file.id });
});

// all uploaded files
app.get("/files", (req, res) => {
  gridfsBucket.find().toArray((err, files) => {
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: "No Files Exist",
      });
    }
    return res.json(files);
  });
});

//showing json doc of any given id
app.get("/files/:id", (req, res) => {
  const { id } = req.params;
  const _id = mongoose.Types.ObjectId(id);
  gridfsBucket.find({ _id }).toArray((err, files) => {
    if (!files[0]) {
      return res.status(404).json({
        err: "No File Exist",
      });
    }
    res.json(files[0]);
  });
});

//retriving image from DB
app.get("/images/:id", (req, res) => {
  const { id } = req.params;
  const _id = mongoose.Types.ObjectId(id);
  gridfsBucket.find({ _id }).toArray((err, file) => {
    if (file.length === 0) {
      return res.status(404).json({
        err: "No File Exist",
      });
    }

    if (
      //checking contentType
      file[0].contentType === "image/jpeg" ||
      file[0].contentType === "img/png"
    ) {
      //showing image
      const readstream = gridfsBucket.openDownloadStream(file[0]._id);
      readstream.pipe(res);
    } else {
      return res.status(404).json({
        err: "Not an image",
      });
    }
  });
});

//creating server
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
