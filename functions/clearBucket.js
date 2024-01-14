const { S3 } = require('aws-sdk');

const s3 = new S3();
const S3_BUCKET_NAME = 'crow.so.admin';

async function clearS3Bucket(bucketName) {
    try {
        const objects = await s3.listObjectsV2({ Bucket: bucketName }).promise();

        if (objects.Contents.length > 0) {
            const objectsToDelete = objects.Contents.map(obj => ({ Key: obj.Key }));

            await s3.deleteObjects({
                Bucket: bucketName,
                Delete: { Objects: objectsToDelete },
            }).promise();

            console.log(`S3 bucket ${bucketName} cleared successfully.`);
        } else {
            console.log(`S3 bucket ${bucketName} is already empty.`);
        }
    } catch (error) {
        console.error(`Error clearing S3 bucket ${bucketName}: ${error.message}`);
    }
}

module.exports = { clearS3Bucket };
