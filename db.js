// Picks the database: Firestore (real) or memory (demo).
// dotenv must already be loaded before this file is required.
const useMock = process.env.USE_MOCK_DB === 'true';
module.exports = useMock ? require('./memoryDb') : require('./firestoreDb');
