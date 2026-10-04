SKILLSWAP
You teach a skill. You learn a skill. Everybody wins.

Live Preview: https://skillswapfin.netlify.app

==================================================
ABOUT
==================================================

SkillSwap is a peer-to-peer skill exchange platform. Instead of paying for
courses, people trade what they know. Find someone who teaches what you want
to learn, propose a swap, chat, and meet in a live 1-on-1 video session.
After each session, ratings and teaching hours build a public reputation.

Built with vanilla JavaScript, Firebase, and WebRTC, with no custom backend
and no build step.

==================================================
THE PROBLEM
==================================================

Learning new skills is expensive, and most online courses are one-way and
passive. Meanwhile, almost everyone has a skill they could share. SkillSwap
connects these people so that learning becomes a fair, two-way exchange
instead of a purchase.

==================================================
FEATURES
==================================================

Accounts and Profiles
  - Email and password sign-up and login through Firebase Authentication
  - Profile with name, avatar, bio, skills to teach, and skills to learn
  - Personal dashboard showing average star rating and total teaching hours
  - Add and remove skills at any time

Discover People
  - Browse community members as cards
  - Search by name or skill
  - Filter by skill category
  - See who is currently online (live presence)

Swap Requests
  - Send a request: "I want to learn X from you, and I'll teach you Y."
  - Incoming, Sent by me, and Active swaps tabs with live counters
  - Accept or decline incoming requests
  - Status changes sync instantly to both users

Direct Messaging
  - One-to-one chat between swap partners
  - Real-time delivery with no page refresh
  - Both users always land in the same chat room

Live 1-on-1 Video Calls
  - Real camera and microphone through WebRTC (peer-to-peer)
  - Incoming call popup with a ringtone made by the Web Audio API
  - Unanswered calls expire automatically after 90 seconds
  - Mute/unmute microphone and camera on/off controls
  - Live call timer

Ratings and Teaching Hours
  - Rating prompt appears when a call ends
  - 5-star rating plus session duration
  - Teacher's average rating and total hours taught update automatically

Realtime Everything
  - Profiles, requests, chat, presence, and call signaling all sync live
    through Firebase listeners

==================================================
HOW IT WORKS
==================================================

1. Sign up and create a profile with skills you teach and want to learn.
2. Browse other members and find a good match.
3. Send a swap request describing what you will trade.
4. The other person accepts it from their requests inbox.
5. Chat or start a video call from the active swap.
6. End the call and rate the session. Stars and hours are added to the
   teacher's profile.
7. Your dashboard reflects your growing reputation.

==================================================
TECH STACK
==================================================

Frontend         HTML5, CSS3, vanilla JavaScript (ES modules), single-page app
Authentication   Firebase Authentication (email and password)
Database         Firebase Realtime Database
Video and audio  WebRTC (RTCPeerConnection, getUserMedia)
NAT traversal    Google public STUN server (stun:stun.l.google.com:19302)
Sound            Web Audio API (ringtone)
Fonts            Google Fonts (Fraunces, Inter)
SDK              Firebase JS SDK v10.12.2 (loaded from CDN)

==================================================
ARCHITECTURE
==================================================

  User A browser  <---- WebRTC video (peer-to-peer) ---->  User B browser
        |                                                       |
        +----------------->  Firebase  <------------------------+
                             - Authentication
                             - Realtime Database

                       Google STUN server
                       (helps browsers find their public address)

- Firebase stores accounts and data, and also carries the small setup
  messages needed to start a video call.
- Video and audio never pass through a server. They flow directly between
  the two browsers.
- STUN is used only during setup.

==================================================
VIDEO CALL FLOW (WEBRTC)
==================================================

WebRTC does not include a way for two browsers to find each other, so
SkillSwap uses Firebase as the signaling channel:

1. The caller creates an offer and saves it to calls/<callId>, then writes a
   ping to incomingCalls/<calleeId>.
2. The callee sees the incoming call popup (with ringtone) and accepts.
3. The callee creates an answer and saves it to the same call record.
4. Both sides exchange ICE candidates (possible network paths) through
   Firebase.
5. A direct peer-to-peer connection is established, and video and audio flow
   between the browsers.
6. When the call ends, signaling data is cleaned up and the rating prompt
   appears.

WebRTC media is encrypted by default (DTLS-SRTP).

==================================================
DATABASE STRUCTURE
==================================================

people/<uid>          name, avatar, bio, teach, learn, rating, hours taught,
                      online status
requests/<requestId>  sender, receiver, offered skill, wanted skill, message,
                      status (pending, accepted, or declined)
calls/<callId>        offer, answer, ICE candidates, status
incomingCalls/<uid>   caller info for the ringing popup
chats/<chatId>        messages (chatId = both user IDs sorted and joined)

Rating formula (a running average):
  newAverage = (oldAverage x oldCount + newStars) / (oldCount + 1)

==================================================
PROJECT STRUCTURE
==================================================

SkillSwap/
  index.html          Page structure: home, sign-up, login, browse,
                      requests, chat, dashboard
  style.css           Responsive styling
  script.js           Main application logic (Firebase, WebRTC, UI)
  firebase-config.js  Firebase configuration and recommended database rules
  app.js              Original localStorage prototype (not loaded)
  README.md           Documentation

Note: script.js is the live app. app.js is the earlier prototype built
before Firebase was added.

==================================================
GETTING STARTED
==================================================

Prerequisites
  - A modern browser (Chrome, Edge, Firefox, or Brave)
  - A free Firebase account
  - A way to serve files locally

Step 1: Clone the repository
  git clone https://github.com/am5843063-collab/SkillSwap.git
  cd SkillSwap

Step 2: Create your own Firebase project
  - Add a project in the Firebase console and register a web app.
  - Enable Authentication > Sign-in method > Email/Password.
  - Create a Realtime Database.

Step 3: Add your config
  Open firebase-config.js and replace the values in firebaseConfig with your
  own project's values.

Step 4: Publish the database rules
  Copy the rules from the bottom of firebase-config.js into
  Realtime Database > Rules and click Publish.

Step 5: Run from a local server
  The app uses ES modules and camera access, so it will NOT work by
  double-clicking index.html. Use one of these:
    python -m http.server 5500
    npx serve
    or the VS Code "Live Server" extension
  Then open http://localhost:5500

Step 6: Test with two users
  Open the app in two different browsers (or one normal and one incognito
  window), create two accounts, and run the full flow: request, accept,
  chat, call, rate.

Deploying
  Host the static files on GitHub Pages, Netlify, or Firebase Hosting. After
  deploying, add your domain under Firebase Console > Authentication >
  Settings > Authorized domains, or login will fail.

==================================================
SECURITY NOTES
==================================================

- Passwords are handled entirely by Firebase Authentication and are never
  stored by the app.
- The Firebase web API key is not a secret. It identifies the project. Real
  protection comes from your database security rules, which should require
  authentication.
- Always publish the rules before sharing the app. Firebase test mode rules
  expire and are not safe to ship.

==================================================
KNOWN LIMITATIONS
==================================================

- Ratings and hours are written from the client, so a determined user could
  tamper with them. A production version should use Cloud Functions.
- Database rules are permissive. Any signed-in user can write to profiles.
- No TURN server. Video uses STUN only, so calls may fail on very
  restrictive networks.
- Calls are one-to-one only.
- No moderation tools yet, such as report, block, or email verification.

==================================================
ROADMAP
==================================================

- TURN relay for reliable calls on all networks
- Cloud Functions for trusted ratings and hours
- One rating per completed session
- Smart skill-matching and recommendations
- Session scheduling and reminders
- Written reviews on profiles
- Report and block features, email verification
- Screen sharing
- Group sessions
- Mobile app

==================================================
CONTRIBUTING AND LICENSE
==================================================

Contributions, ideas, and bug reports are welcome. Open an issue or submit
a pull request.

Add a license of your choice (for example, MIT) as a LICENSE file so others
know how they can use this code.

Built for a hackathon. Learn from each other.
