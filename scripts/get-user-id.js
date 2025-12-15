import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();

async function getUserId() {
  try {
    const user = await auth.getUserByEmail('tenwenshean@gmail.com');
    console.log('User ID for tenwenshean@gmail.com:', user.uid);
    return user.uid;
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

getUserId().then(() => process.exit(0));
