import fs from 'node:fs/promises';
import path from 'node:path';

// This script uploads all PDF files from the 'data' folder which are not already in the storage API to the ingestion API
// It does a Node.js equivalent of this bash script:
// ```
// for file in data/*.pdf; do
//   curl -X POST -F "file=@$file" <api_url>/api/documents
// done
// ```
async function uploadDocuments(apiUrl, dataFolder) {
  try {
    const uploadUrl = `${apiUrl}/api/documents`;
    const files = await fs.readdir(dataFolder);
    console.log(`Uploading documents to: ${uploadUrl}`);

    /* eslint-disable no-await-in-loop */
    for (const file of files) {
      if (path.extname(file).toLowerCase() === '.pdf') {
        const filePath = path.join(dataFolder, file);

        // Test if file already exist in blob storage
        const FileResponse = await fetch(`${uploadUrl}/${file}`);

        if (FileResponse.status === 404) {
          console.log(`File ${file} does not exist in the blob storage.`);
          // File does not exist, proceed with upload
          const data = await fs.readFile(filePath);
          const blobParts = new Array(data);
          const formData = new FormData();
          formData.append('file', new File(blobParts, file));

          const response = await fetch(uploadUrl, {
            method: 'post',
            body: formData,
          });

          const responseData = await response.json();
          if (response.ok) {
            console.log(`${file}: ${responseData.message}`);
          } else {
            throw new Error(responseData.error);
          }
        } else {
          // File already exists in the blob storage
          console.log(`File ${file} already exists in the blob storage, skipping upload.`);
        }
      }
    }
    /* eslint-enable no-await-in-loop */
  } catch (error) {
    console.error(`Could not upload documents: ${error.message}`);
    process.exitCode = -1;
  }
}

const apiUrl = process.argv[2];
if (apiUrl) {
  await uploadDocuments(apiUrl, 'data');
} else {
  console.log('Usage: node upload-documents.js <api_url> ');
  process.exitCode = -1;
}
