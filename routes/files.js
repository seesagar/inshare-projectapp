const router = require("express").Router();
const multer = require("multer"); //Multer is a node. js middleware for handling multipart/form-data , which is primarily used for uploading files.
const path = require("path"); //it is to add extension like .pdf .txt at the end of the file but it has different uses as well
const File = require("../models/file");
const { v4: uuid4 } = require("uuid"); // universally unique identifier, npm package is a secure way to generate cryptographically strong unique identifiers with Node. js

//calling diskStorage method
let storage = multer.diskStorage({
  //cb is for callback function
  destination: (req, file, cb) => cb(null, "uploads/"), //null wala parameter is for error

  filename: (req, file, cb) => {
    const d = new Date();

    const uniqueName = `${d.getTime()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    // console.log(uniqueName);
    //343242334-34243442345.pdf just as an example
    cb(null, uniqueName); //null wala parameter is for error
  },
});

let upload = multer({
  storage,
  limit: { fileSize: 1000000 * 100 },
}).single("myfile"); //we wrote single coz we want single file not multiple files at once. Inside it we wrote "myfile" coz jo naam form data k key mai likha tha vahi as it is likhna hai (see postman for this)

router.post("/", (req, res) => {
  //store file
  upload(req, res, async (err) => {
    //validating the requests here
    if (!req.file) {
      //req.file has came from multer middleware
      return res.json({ error: "All fields are necessary" });
    }
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // store into database
    const file = new File({
      filename: req.file.filename,
      path: req.file.path,
      uuid: uuid4(),
      size: req.file.size,
    });

    const response = await file.save();
    return res.json({
      files: `${process.env.APP_BASE_URL}/files/${response.uuid}`, //this is basically our donwload link
      //http://localhost:3000/files/jsafjdgjd-24jdsvj    this is how the download link will look like
    });
  });

  //Response link for downloading
});

router.post("/send", async (req, res) => {
  const { uuid, emailTo, emailFrom } = req.body;
  // console.log(req.body);
  // return res.send({});
  //validating the request
  if (!uuid || !emailFrom || !emailTo) {
    return res.status(422).send({ error: "all fields are required" });
  }

  //get data from database
  const file = await File.findOne({ uuid: uuid });
  if (file.sender) {
    return res.status(422).send({ error: "Email already sent" });
  }

  file.sender = emailFrom;
  file.receiver = emailTo;
  const response = await file.save();

  //send email
  const sendMail = require("../services/emailService");
  sendMail({
    from: emailFrom,
    to: emailTo,
    subject: "inShare file sharing",
    text: `${emailFrom} shared a file with you`,
    html: require("../services/emailTemplate")({
      emailFrom: emailFrom,
      downloadLink: `${process.env.APP_BASE_URL}/files/${uuid}`,
      size: parseInt(file.size / 1000) + "KB",
      expires: "24 hours",
    }),
  });

  return res.send({ success: true });
});

module.exports = router;
