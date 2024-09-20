import fs from 'node:fs/promises';
import { type HttpRequest, type HttpResponseInit, type InvocationContext, app } from '@azure/functions';
import { AzureCosmosDBNoSQLVectorStore } from '@langchain/azure-cosmosdb';
import 'dotenv/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { AzureOpenAIEmbeddings } from '@langchain/openai';
import { badRequest, serviceUnavailable, ok } from '../http-response.js';
import { getAzureOpenAiTokenProvider, getCredentials } from '../security.js';

export async function deleteDocuments(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const storageUrl = process.env.AZURE_STORAGE_URL;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
  const cosmosdbEndpoint = process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;
  const cosmosdbDB = 'vectorSearchDB';
  const cosmosdbContainer = 'vectorSearchContainer';
  const credentials = getCredentials();

  try {
    // Get the uploaded file from the request
    const parsedForm = await request.formData();

    if (!parsedForm.has('file')) {
      return badRequest('"file" field not found in form data.');
    }

    // Type mismatch between Node.js FormData and Azure Functions FormData
    const file = parsedForm.get('file') as any as File;
    const filename = file.name;

    if (azureOpenAiEndpoint) {
      const azureADTokenProvider = getAzureOpenAiTokenProvider();

      // Initialize embeddings model and vector database
      const embeddings = new AzureOpenAIEmbeddings({ azureADTokenProvider });
      const vectorStore = new AzureCosmosDBNoSQLVectorStore(embeddings, {
        endpoint: cosmosdbEndpoint,
        credentials,
        databaseName: cosmosdbDB,
        containerName: cosmosdbContainer,
      });

      // Initialize the vector store
      await vectorStore.initialize();

      const deleteParameters = {
        filter: `metadata.source: ${filename}`,
      };

      await vectorStore.delete(deleteParameters);
      console.log(`Deleted document with filename: ${filename}`);
    } else {
      // Delete on local setup  has not been implemented yet
    }

    if (storageUrl && containerName) {
      // Delete the PDF file from Azure Blob Storage
      context.log(`Deleting file from blob storage: "${containerName}/${filename}"`);

      const blobServiceClient = new BlobServiceClient(storageUrl, credentials);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(filename);

      try {
        await blockBlobClient.delete();
        context.log(`File "${filename}" deleted successfully from blob storage.`);
      } catch (error) {
        context.log(`Error deleting file "${filename}" from blob storage:`, error);
      }
    } else {
      context.log('No Azure Blob Storage connection string set, skipping delete.');
    }

    return ok({ message: 'PDF file deleted successfully.' });
  } catch (_error: unknown) {
    const error = _error as Error;
    context.error(`Error when processing document-delete request: ${error.message}`);

    return serviceUnavailable('Service temporarily unavailable. Please try again later.');
  }
}

async function checkFolderExists(folderPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(folderPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

app.http('documents-delete', {
  route: 'documents',
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler: deleteDocuments,
});
