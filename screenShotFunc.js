
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');
const OpenAI = require("openai");
const { S3 } = require('aws-sdk');
const s3 = new S3();

const S3_BUCKET_NAME = 'crow.so.admin';

dotenv.config();
const openAPIKEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: openAPIKEY });

// this is for testing purpose---------------------------------->>>>>

// this is for testing purpose------>>>>>


// ----------------woking function =---------------->>>
async function captureScreenshots(inputUrl, screenshotPath) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    let screenshotsData = [];

    try {
        await page.goto(inputUrl, { waitUntil: 'networkidle0' });
        await page.waitForTimeout(5000);

        const { width: totalWidth, height: totalHeight } = await page.evaluate(() => ({
            width: document.body.scrollWidth,
            height: document.body.scrollHeight,
        }));

        for (let x = 0; x < totalWidth; x += 1920) {
            for (let y = 0; y < totalHeight; y += 1080) {
                await page.setViewport({ width: 1920, height: 1080 });
                await page.evaluate((x, y) => window.scrollTo(x, y), x, y);
                await page.waitForTimeout(2000);

                const screenshotImageData = await page.screenshot({
                    encoding: 'base64',
                    type: 'jpeg',
                });

                const fileName = `${Date.now()}_${x}_${y}.jpg`;

                const s3Params = {
                    Bucket: S3_BUCKET_NAME,
                    Key: `${screenshotPath}/${fileName}`,
                    Body: Buffer.from(screenshotImageData, 'base64'),
                    ContentType: 'image/jpeg',
                };

                const imageUrl = await uploadToS3(s3Params);
                // console.log("imageUrl",imageUrl)
                screenshotsData.push({ key: `${x}_${y}`, imageUrl });
            }
        }
    } catch (error) {
        console.error(`An error occurred while capturing screenshots: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    // console.log("screenshotsData",screenshotsData)
    return screenshotsData;
}


let retryCount = 0;

async function getGPTFeedback(imageData, tokenCount,retryCount=0) {
    // console.log("gpt imageaData :-" , imageData)
    const prompt = `
    You are an expert in CRO analysis. You have knowledge and experience in UI, UX, DESIGN, Web Development and SHOPIFY. Please analayse the following screenshot and give output using the following criteria :
    “Analyze the provided website screenshot and generate outputs in the following specific categories, structuring each as a separate key in JSON format:
    CRO Feedback of Image: Provide detailed feedback focused solely on Conversion Rate Optimization aspects evident in the image. Analyze elements such as layout, content, navigation, and user engagement features in relation to their potential impact on conversion rates.
    Page_Section: Identify and list all distinct webpage sections visible in the screenshot. Return only the names of these sections, such as ‘header’, ‘testimonial’, ‘product’, etc., without any additional text or explanation.
    Query for RAG Database (Website HTML): Formulate a query suitable for retrieving relevant HTML content from a RAG database that contains the website’s HTML. This query should be based on the visual contents and layout observed in the screenshot.
    Query for RAG Database (CRO Advice per Section): Create a query for retrieving CRO advice from a RAG database, specific to each identified section of the webpage. This query should aim to gather detailed CRO best practices and suggestions relevant to the sections identified in the screenshot.
    Ensure each category is distinctly separated and clearly labeled within the JSON output for easy parsing and integration into the application.
    `;

    const response = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: "text",
                        text: prompt
                        // text: "Tell me what is in this image"
                    },
                    {
                        type: "image_url",
                        image_url: imageData,
                        
                    },
                ],
            },
        ],
        max_tokens: 300,
    });

    tokenCount += response.usage.total_tokens;
    // console.log("Token:-",tokenCount) 
    // console.log("response:-",response)
    const feedbackContent = response.choices[0].message.content;

    // calling the gpt functio second time
    // if (!feedbackContent || feedbackContent === "Unfortunately, I cannot provide feedback or analysis on this image." || "I'm sorry, but I can't help with analyzing or providing information about the image you have provided.") {
    
     // calling the gpt function the second time
     if (
        !feedbackContent ||
        feedbackContent === "Unfortunately, I cannot provide feedback or analysis on this image." ||
        feedbackContent === "I'm sorry, but I can't help with analyzing or providing information about the image you have provided."||
        feedbackContent === "Unfortunately, I can't assist with that request.."
    ) {
        if (retryCount < 1){
            console.log("Re-running GPT function...");
            retryCount++;
            return getGPTFeedback(imageData, tokenCount);
        } else {
            console.log("Maximum count to run this function is one time only");
            return "Maximum count to run this function is one time only.";
        }
    }

    return feedbackContent;
}

async function writeFeedbackToJSON(websiteName, feedbackArray, filePath) {
    // console.log("jjjjjjjjjjfpath",filePath)
    try {
        await fs.truncate(filePath, 0);
        let existingData = {};

        try {
            const jsonData = await fs.readFile(filePath, 'utf-8');
            existingData = JSON.parse(jsonData);
        } catch (readError) {
            if (readError.code !== 'ENOENT') {
                console.error(`Error reading existing JSON data: ${readError.message}`);
            }
        }

        if (!existingData[websiteName]) {
            existingData[websiteName] = [];
        }

        existingData[websiteName].push(...feedbackArray);

        await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
        // console.log(`Feedback written to ${filePath}`);
    } catch (error) {
        console.error(`Error writing feedback to JSON file: ${error.message}`);
    }
}


async function screenShotFunc(inputUrl, websiteName, res) {
    const screenshotsParentPath = 'screenshots';
    
    try {
        // console.log("hey m running......")
        await fs.mkdir(screenshotsParentPath, { recursive: true });
        const baseFolderName = inputUrl.replace(/[^a-zA-Z0-9]/g, '_');
        let folderName = baseFolderName;

        let folderCount = 1;
        while (await fs.access(path.join(screenshotsParentPath, folderName)).then(() => true).catch(() => false)) {
            folderCount++;
            folderName = `${baseFolderName}${folderCount}`;
        }

        const screenshotsData = await captureScreenshots(inputUrl, path.join(screenshotsParentPath, folderName));
        // console.log("screenshotsData",screenshotsData)
        const feedbackArray = [];
for (let index = 0; index < screenshotsData.length; index++) {
    // console.log("screenshotsData[index].imageUrl",screenshotsData[index].imageUrl)
    const feedback = await getGPTFeedback(screenshotsData[index].imageUrl);
    if (feedback) {
        // console.log(`Feedback for image ${index + 1}:`, feedback);
        feedbackArray.push({
            [`Image_url_${index + 1}`]: screenshotsData[index].imageUrl,
            [`feedbackforimg_${index + 1}`]: feedback,
        });
    }
}
// console.log('Complete feedbackArray:', feedbackArray);

        const feedbackFilePath = path.join(__dirname, 'feedback.json');
        await writeFeedbackToJSON(websiteName.toString(), feedbackArray, feedbackFilePath);

        res.status(200).json({ message: "Screenshots taken successfully!", screenshots: screenshotsData, websiteName });
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
        res.status(400).json({ error: error.message });
    }
}
 
async function uploadToS3(s3Params) {
    try {
        const data = await s3.upload(s3Params).promise();
        // console.log('Image uploaded to S3:', data.Location);
        return data.Location;
    } catch (error) {
        console.error(`Error uploading to S3: ${error.message}`);
        throw error;
    }
}

module.exports = { screenShotFunc };



