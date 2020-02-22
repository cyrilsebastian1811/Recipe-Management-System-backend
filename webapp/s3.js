const AWS = require('aws-sdk');
const s3Bucket = process.env.S3_BUCKET;

// Create S3 service object
s3 = new AWS.S3({apiVersion: '2006-03-01'});


const uploadFile = (file) => {
    return new Promise((resolve, reject) => {
        // call S3 to retrieve upload file to specified bucket
        var uploadParams = {Bucket: s3Bucket, Key: '', Body: ''};
        var filePath = file.path;
        var fileExtension = file.name.split(".")[1];

        // Configure the file stream and obtain the upload parameters
        var fs = require('fs');
        var fileStream = fs.createReadStream(filePath);
        fileStream.on('error', function(err) {
            console.log('File Error', err);
        });
        uploadParams.Body = fileStream;
        var path = require('path');
        uploadParams.Key = path.basename(filePath) + "." + fileExtension;

        // call S3 to retrieve upload file to specified bucket
        s3.upload (uploadParams, function (err, data) {
            if (err) {
                console.log("Error", err);
            } if (data) {
                // console.log("Upload Success", data);
                resolve(data);
            }
        });
    })
}

const deleteFile = (key) => {
    const params = {
        Bucket: s3Bucket,
        Key: key
    };

    return new Promise((resolve, reject) => {
        s3.deleteObject(params, function(err, data) {
            if (err) {
                console.log("Error", err);
            } else {
                resolve(data);
            }
        });
    });
}

module.exports = {
    uploadFile,
    deleteFile,
}