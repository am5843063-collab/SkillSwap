# SkillSwap - Peer-to-Peer Learning & Video Calling Web Application

<----Preview Link----->
https://skillswapfin.netlify.app

SkillSwap is a responsive, modern web application designed for people to trade skills—teaching what they know and learning what they want from peers—with integrated live 1-on-1 video calling and a profile dashboard.

Built using clean, semantic **HTML5**, modern glassmorphic **CSS3**, and beginner-friendly vanilla **JavaScript**.

---

## 🌟 Key Features

1. **Skill Discovery Marketplace (`Explore Skills`)**:
   - Browse community members and mentors.
   - Search by skill name, discipline, or topic.
   - Category filtering (Coding, Design, Languages, Music, Marketing).
   - "Matches My Wishlist" toggle to find mentors who teach what you want to learn.

2. **Skill Swap Proposal System**:
   - Send requests proposing: *"I want to learn [Skill X] from you, and I will teach you [Skill Y] in return."*
   - Add a personalized introductory note.
   - Incoming Requests Inbox with **Accept** and **Decline** actions.
   - Real-time notification badge on the navigation bar.

3. **Live 1-on-1 Video Calling Room**:
   - Real webcam & microphone access using native WebRTC `navigator.mediaDevices.getUserMedia`.
   - Graceful camera simulator fallback for devices without a physical webcam or if permissions are blocked.
   - Call controls: Mute/Unmute Mic, Camera On/Off, Screen Sharing, and Fullscreen.
   - Real-time session stopwatch timer.
   - In-call collaborative chat & code notes drawer.

4. **Post-Call Rating, Feedback & Teaching Hours**:
   - Automatically prompted when ending a video call.
   - Interactive 5-star rating selector with hover effects.
   - Calculates duration in minutes and converts it to **Teaching Hours**.
   - Automatically credits hours and updates the mentor's average star rating and review history.

5. **Profile Dashboard**:
   - Displays **Skills Teached** counter and badge list.
   - Displays **Skills Learned** counter and wishlist.
   - Displays **Average Star Rating** (e.g., 4.9 ★) with student reviews.
   - Displays **Hours Teached** counter.
   - Add/remove skills dynamically.
   - Edit profile details (name, headline, bio).

6. **Interactive User Switcher (For Testing)**:
   - Easily switch between demo profiles (Elena Rostova, Alex Rivers, Marcus Vance, Priya Sharma, Liam O'Connor) or create your own account.
   - Perfect for testing sending a request as User A and accepting it as User B on the same machine!

---

## 📁 Project Structure

```
skillswap/
├── index.html       # Complete HTML5 structure, semantic tags, SVG icons, and modal dialogs
├── style.css        # Responsive CSS with glassmorphism, flexbox/grid, animations & dark theme
├── app.js           # Beginner-friendly JavaScript with state management, WebRTC, and localStorage
└── README.md        # Documentation and walkthrough guide
```

---

## 🚀 How to Run the Application

You do not need any build steps, Node.js packages, or local servers.

1. Navigate to the folder:
   ```
   C:\Users\hp\.gemini\antigravity\scratch\skillswap\
   ```
2. Double-click **`index.html`** or right-click and choose **Open with > Chrome / Edge / Firefox / Brave**.
3. That's it! Everything runs directly inside your web browser.

---

## 💡 Beginner Learning Guide

- **HTML (`index.html`)**: Observe how standard `<section>` containers with classes like `.tab-pane` are used to build a Single Page Application (SPA) without reloading the page.
- **CSS (`style.css`)**: Look at the `:root` variables for colors and design tokens, and notice how CSS Grid (`grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))`) effortlessly creates responsive layouts.
- **JavaScript (`app.js`)**:
  - `localStorage`: See how `localStorage.setItem` and `getItem` keep your data saved even when you refresh the page.
  - `getUserMedia`: Learn how modern browsers capture webcam video streams directly through JavaScript.
