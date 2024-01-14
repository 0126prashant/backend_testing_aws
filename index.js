const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser'); 
const routerScreenshot = require('./routes/screenshot.routes');
require('dotenv').config();

const app = express();
app.use(cors());

// Increase payload size limit
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));

app.use("/screenshots", routerScreenshot);

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
