import fs from 'node:fs/promises';
import path from 'node:path';

// This script delete all PDF files from the 'data/to_delete' folder which are in the Storage and in Cosmodb
// It does a Node.js equivalent of this bash script:
// ```
// for file in data/to_delete/*.pdf; do
//   curl -X DELETE -F "file=@$file" <api_url>/api/documents
// done
// ```
async function deleteDocuments(apiUrl, deleteFolder) {
  try {
    const FunctionAppUrl = `${apiUrl}/api/documents`;
    const files = await fs.readdir(deleteFolder);
    console.log(`Deleting documents to: ${FunctionAppUrl}`);

    /* eslint-disable no-await-in-loop */
    for (const file of files) {
      if (path.extname(file).toLowerCase() === '.pdf') {
        const filePath = path.join(deleteFolder, file);

        // Test if file already exist in blob storage
        const FileResponse = await fetch(`${FunctionAppUrl}/${file}`);
        if (FileResponse.status === 404) {
          console.log(`File ${file} does not exist in the blob storage. No delete needed.`);
        } else {
          // File already exists in the blob storage
          console.log(`File ${file} already exists in the blob storage, deleting from storage and cosmosdb.`);

          const data = await fs.readFile(filePath);
          const blobParts = new Array(data);
          const formData = new FormData();
          formData.append('file', new File(blobParts, file));

          const response = await fetch(FunctionAppUrl, {
            method: 'delete',
            body: formData,
          });

          const responseData = await response.json();
          if (response.ok) {
            console.log(`${file}: ${responseData.message}`);
          } else {
            throw new Error(responseData.error);
          }
        }
      }
    }
    /* eslint-enable no-await-in-loop */
  } catch (error) {
    console.error(`Could not delete documents: ${error.message}`);
    process.exitCode = -1;
  }
}

const apiUrl = process.argv[2];
if (apiUrl) {
  await deleteDocuments(apiUrl, 'data/to_delete');
} else {
  console.log('Usage: node delete-documents.js <api_url> ');
  process.exitCode = -1;
}
