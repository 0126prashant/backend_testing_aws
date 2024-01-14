const express = require('express');
const routerScreenshot = express.Router();
const { screenShotFunc } = require('../screenShotFunc');
const path = require('path');
const fs = require('fs/promises')
// const fs = require('fs');
const parseUrl = require('url-parse');
const { clearS3Bucket } = require('../functions/clearBucket');
let globalWebsiteName; 
const S3_BUCKET_NAME = 'crow.so.admin';

// routerScreenshot.post("/", (req, res) => {
//     const { url: inputUrl } = req.body;

//     if (!inputUrl) {
//         return res.status(400).json({ error: "URL is required in the request body." });
//     }
//     const parsedUrl = parseUrl(inputUrl);
//      let websiteName = parsedUrl.hostname;
//      globalWebsiteName = websiteName
//     //  localStorage.setItem("websiteName")
//     if (!websiteName) {
//         return res.status(400).json({ error: "Invalid URL. Unable to extract the website name." });
//     }
// console.log("websiteName",websiteName)
//     screenShotFunc(inputUrl, websiteName, res);
// });
routerScreenshot.post("/", async (req, res) => {
    const { url: inputUrl } = req.body;

    if (!inputUrl) {
        return res.status(400).json({ error: "URL is required in the request body." });
    }

    const parsedUrl = parseUrl(inputUrl);
    let websiteName = parsedUrl.hostname;
    globalWebsiteName = websiteName;

    if (!websiteName) {
        return res.status(400).json({ error: "Invalid URL. Unable to extract the website name." });
    }

    try {
        await clearS3Bucket(S3_BUCKET_NAME);
        await screenShotFunc(inputUrl, websiteName, res);
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
        res.status(500).json({ error: "Internal server error." });
    }
});

routerScreenshot.get('/feedback/:key', async (req, res) => {
  try {
      const key = req.params.key;
    //   let websiteName = parseUrl(req.headers.origin).hostname;
      let websiteName = globalWebsiteName;
    //   let websiteName = "www.mudcy.com";
    //   console.log(key, "key");
    //   console.log("websiteName",websiteName)
      // Define the website name or replace it with the correct value
      

      // Construct the correct feedback file path
      console.log("path",__dirname)
      const feedbackFilePath = path.join(__dirname, "..",'feedback.json');


      console.log("feedbackFilePath", feedbackFilePath);

      const jsonData = await fs.readFile(feedbackFilePath, 'utf-8');
      const feedbackData = JSON.parse(jsonData);

      console.log("feedbackData",feedbackData[websiteName][0][key])
      if (feedbackData[websiteName]) {
          res.status(200).json({ feedback: feedbackData[websiteName][0][key] });
      } else {
          res.status(404).json({ error: 'Website not found in feedback data' });
      }
  } catch (error) {
      console.error(`Error retrieving feedback data: ${error.message}`);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

  

module.exports = routerScreenshot;
