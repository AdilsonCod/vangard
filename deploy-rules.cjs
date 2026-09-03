/**
 * deploy-rules.cjs
 * Deploys open Firestore security rules via the Firebase Management API.
 * Uses the project's API key (no Firebase CLI login required).
 */
const https = require('https');
const config = require('./firebase-applet-config.json');

const PROJECT_ID = config.projectId;
const DATABASE_ID = config.firestoreDatabaseId || '(default)';
const API_KEY = config.apiKey;

const OPEN_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2027, 1, 1);
    }
  }
}`;

const body = JSON.stringify({
  source: {
    files: [
      {
        content: OPEN_RULES,
        name: 'firestore.rules',
      },
    ],
  },
});

const options = {
  hostname: 'firebaserules.googleapis.com',
  path: `/v1/projects/${PROJECT_ID}/rulesets?key=${API_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log(`\nDeploying open rules to project: ${PROJECT_ID}`);
console.log(`Database: ${DATABASE_ID}\n`);

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const resp = JSON.parse(data);
      const rulesetName = resp.name;
      console.log('✅ Ruleset created:', rulesetName);

      // Now release it to the database
      const releaseBody = JSON.stringify({
        release: {
          name: `projects/${PROJECT_ID}/releases/cloud.firestore/${DATABASE_ID}`,
          rulesetName: rulesetName,
        },
      });

      const releaseOptions = {
        hostname: 'firebaserules.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/releases?key=${API_KEY}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(releaseBody),
        },
      };

      const releaseReq = https.request(releaseOptions, (releaseRes) => {
        let releaseData = '';
        releaseRes.on('data', (chunk) => { releaseData += chunk; });
        releaseRes.on('end', () => {
          if (releaseRes.statusCode >= 200 && releaseRes.statusCode < 300) {
            console.log('✅ Rules deployed successfully to database:', DATABASE_ID);
            console.log('   You can now reload the app and login normally.\n');
          } else {
            console.error('❌ Failed to release rules:', releaseData);
            console.log('\n--- ALTERNATIVE MANUAL FIX ---');
            printManualInstructions();
          }
        });
      });

      releaseReq.on('error', (e) => {
        console.error('❌ Release request error:', e.message);
        printManualInstructions();
      });
      releaseReq.write(releaseBody);
      releaseReq.end();

    } else {
      console.error('❌ Failed to create ruleset. Status:', res.statusCode);
      console.error('Response:', data);
      console.log('\n--- MANUAL FIX REQUIRED ---');
      printManualInstructions();
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  printManualInstructions();
});

req.write(body);
req.end();

function printManualInstructions() {
  console.log(`
To fix manually, go to:
https://console.firebase.google.com/project/${PROJECT_ID}/firestore/rules

And paste these rules:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2027, 1, 1);
    }
  }
}

Make sure to select the database: "${DATABASE_ID}"
`);
}
