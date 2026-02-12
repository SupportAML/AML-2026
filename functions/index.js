/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");


const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Callable Cloud Function: deleteUserAuth
exports.deleteUserAuth = functions.https.onCall(async (data, context) => {
  // Verify caller is authenticated and is admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Request has no auth context.');
  }
  const callerUid = context.auth.uid;
  // Read caller role from custom claims (recommended) or from authorizedUsers collection server-side
  const claims = context.auth.token || {};
  if (claims.role !== 'ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const userIdToDelete = data.userId;
  if (!userIdToDelete) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing userId');
  }

  try {
    await admin.auth().deleteUser(userIdToDelete);
    return { success: true };
  } catch (err) {
    console.error('deleteUserAuth error:', err);
    throw new functions.https.HttpsError('internal', 'Failed to delete user: ' + (err.message || err));
  }
});
// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
