/* ==========================================================================
   FIREBASE CONFIG
   --------------------------------------------------------------------------
   HOW TO GET YOUR OWN VALUES (one-time setup, ~5 minutes):

   1. Go to https://console.firebase.google.com and click "Add project".
      Give it any name, e.g. "skillswap". Finish the wizard.

   2. In your new project, click the "</>" (web) icon to register a web app.
      Give it a nickname. Firebase will show you a config object that
      looks exactly like the one below — copy YOUR values into it here.

   3. Turn on Authentication:
      Build > Authentication > Get started > Sign-in method tab >
      enable "Email/Password".

   4. Turn on Realtime Database:
      Build > Realtime Database > Create Database >
      choose a location > start in "Test mode" for now (we'll lock it
      down with proper rules below — test mode just lets you get moving
      immediately without being blocked by permissions while developing).

   5. Copy the security rules from the bottom of this file into
      Realtime Database > Rules tab, then click "Publish".
      (Test mode rules expire after 30 days and are NOT safe to ship with.)

   6. Paste your real values below, replacing every "YOUR_..." placeholder.
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyB3jRocouI5cBIMk0xotr01y6QwLIK_AiI",
  authDomain: "skillswap-5e2f3.firebaseapp.com",
  databaseURL: "https://skillswap-5e2f3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "skillswap-5e2f3",
  storageBucket: "skillswap-5e2f3.firebasestorage.app",
  messagingSenderId: "1055098213423",
  appId: "1:1055098213423:web:03749b3ed4f49a838f22da",
  measurementId: "G-WK5X20QVJE"
};

/* ==========================================================================
   RECOMMENDED REALTIME DATABASE SECURITY RULES
   --------------------------------------------------------------------------
   Paste this into Firebase Console > Realtime Database > Rules tab.
   This ensures:
   - Anyone signed in can read profiles, requests, and signaling
   - Users can update their profiles and record session ratings/history
   - WebRTC signaling for calls and incoming call notifications work seamlessly

   {
     "rules": {
       "people": {
         ".read": "auth != null",
         "$uid": {
           ".write": "auth != null"
         }
       },
       "requests": {
         ".read": "auth != null",
         "$requestId": {
           ".write": "auth != null"
         }
       },
       "calls": {
         ".read": "auth != null",
         ".write": "auth != null"
       },
       "incomingCalls": {
         ".read": "auth != null",
         "$uid": {
           ".write": "auth != null"
         }
       },
       "chats": {
         ".read": "auth != null",
         "$chatId": {
           ".write": "auth != null"
         }
       }
     }
   }
   ========================================================================== */

export default firebaseConfig;
