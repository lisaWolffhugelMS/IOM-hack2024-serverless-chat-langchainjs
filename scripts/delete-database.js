// This script delete all files from Cosmodb

async function deleteDB(apiUrl) {
  try {
    const FunctionAppUrl = `${apiUrl}/api/db`;
    console.log(`Deleting all documents from db`);

    const response = await fetch(FunctionAppUrl, {
      method: 'delete',
    });

    const responseData = await response.json();
    if (response.ok) {
      console.log(`db deleted`);
    } else {
      throw new Error(responseData.error);
    }
  } catch (error) {
    console.error(`Could not delete the db: ${error.message}`);
    process.exitCode = -1;
  }
}

const apiUrl = process.argv[2];
if (apiUrl) {
  await deleteDB(apiUrl, 'data/to_delete');
} else {
  console.log('Usage: node delete-documents.js <api_url> ');
  process.exitCode = -1;
}
