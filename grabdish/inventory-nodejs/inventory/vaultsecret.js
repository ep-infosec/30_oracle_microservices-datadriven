// Copyright (c) 2021 Oracle and/or its affiliates.
// Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl/
"use strict";

const oracledb = require('oracledb');
const express = require('express');
const common = require("oci-common”);
const secrets = require("oci-secrets");

//const os = require("oci-objectstorage");
const common = require("oci-common");
const fs = require("fs");


const dbConfig = {
  inventoryPool: {
    user: process.env.DB_USER.trim(),
//    password: process.env.DB_PASSWORD.trim(),
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: Number(process.env.DB_CONNECTION_COUNT) || 10,
    poolMax: Number(process.env.DB_CONNECTION_COUNT) || 10,
    poolIncrement: process.env.DB_POOL_INC || 0
    compartmentId: process.env.COMPARTMENT_ID.trim(),
    regionId: process.env.REGION_ID.trim(),
    compartmentId: process.env.COMPARTMENT_ID.trim(),
  }
};

const provider = new common.ConfigFileAuthenticationDetailsProvider();
const args = process.argv.slice(2);
console.log(args);
if (args.length !== 4) {
console.error(
"Unexpected number of arguments received. Consult the script header comments for expected arguments"
);
process.exit(-1);
}

const compartmentId = args[0];
const bucket = args[1];
const object = args[2];
const fileLocation = args[3];

const client = new secrets.SecretsClient({
    authenticationDetailsProvider: provider
});

(async () => {
try {
console.log("Getting the namespace...");
const request = {};
const response = await client.getNamespace(request);
const namespace = response.value;

console.log("Creating the source bucket.");
const bucketDetails = {
name: bucket,
      compartmentId: compartmentId
};
const createBucketRequest = {
    namespaceName: namespace,
    createBucketDetails: bucketDetails
};
const createBucketResponse = await client.createBucket(createBucketRequest);
console.log("Create Bucket executed successfully" + createBucketResponse);

console.log("Bucket is created. Fetch the bucket.");
const getBucketRequest = {
    namespaceName: namespace,
    bucketName: bucket
};
const getBucketResponse = await client.getBucket(getBucketRequest);
console.log("Get bucket executed successfully." + getBucketResponse.bucket);

// Create stream to upload
const stats = fs.statSync(fileLocation);
const nodeFsBlob = new os.NodeFSBlob(fileLocation, stats.size);
const objectData = await nodeFsBlob.getData();

console.log("Bucket is created. Now adding object to the Bucket.");
const putObjectRequest = {
    namespaceName: namespace,
    bucketName: bucket,
    putObjectBody: objectData,
    objectName: object,
    contentLength: stats.size
};
const putObjectResponse = await client.putObject(putObjectRequest);
console.log("Put Object executed successfully" + putObjectResponse);

console.log("Fetch the object created");
const getObjectRequest = {
    objectName: object,
    bucketName: bucket,
    namespaceName: namespace
};
const getObjectResponse = await client.getObject(getObjectRequest);
console.log("Get Object executed successfully.");

const isSameStream = compareStreams(objectData, getObjectResponse.value);
console.log(`Upload stream and downloaded stream are same? ${isSameStream}`);

console.log("Delete Object");
const deleteObjectRequest = {
    namespaceName: namespace,
    bucketName: bucket,
    objectName: object
};
const deleteObjectResponse = await client.deleteObject(deleteObjectRequest);
console.log("Delete Object executed successfully" + deleteObjectResponse);

console.log("Delete the Bucket");
const deleteBucketRequest = {
    namespaceName: namespace,
    bucketName: bucket
};
const deleteBucketResponse = await client.deleteBucket(deleteBucketRequest);
console.log("Delete Bucket executed successfully" + deleteBucketResponse);
} catch (error) {
    console.log("Error executing example " + error);
}
})();

function compareStreams(stream1, stream2) {
return streamToString(stream1) === streamToString(stream2);
}

function streamToString(stream) {
let output = "";
stream.on("data", function(data) {
    output += data.toString();
});
stream.on("end", function() {
return output;
});
}