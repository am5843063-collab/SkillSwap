/* ==========================================================================
   SKILLSWAP — script.js (Firebase edition)
   -------------------------------------------------------------------------
   WHAT CHANGED FROM THE LOCALSTORAGE VERSION:

   1. AUTH: Firebase Authentication (Email/Password) replaces our fake
      "currentUser" — now every user has a real account with a real,
      unique ID (uid) that Firebase generates for us.

   2. DATA: Firebase Realtime Database replaces localStorage. Every
      person's profile and every swap request now lives on Google's
      servers, in a big shared JSON tree, so ALL users see the SAME data
      — that's what makes this a real multi-user app instead of a demo
      that only works in one browser.

   3. VIDEO CALLS: We use real WebRTC (built into every browser) to send
      live camera/microphone data directly between two people's browsers
      (this is called a "peer-to-peer" connection — the video never
      passes through our server, only a small amount of setup data does).

      WebRTC needs a way for the two browsers to "introduce" themselves
      to each other before they can connect directly — this introduction
      process is called SIGNALING, and we use the Realtime Database as
      the messenger for it (like two people passing notes through a
      mailbox before they arrange to meet in person).

   Read this file top to bottom — it's grouped into the same kind of
   labeled sections as before, so if you understood the old version,
   this will feel very familiar.
   ========================================================================== */

/* ==========================================================================
   SECTION 0: FIREBASE SETUP
   We import the pieces we need directly from Google's CDN using ES Module
   imports (that's why index.html loads this file with type="module").
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  update,
  push,
  onValue,
  get,
  remove,
  serverTimestamp,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import firebaseConfig from "./firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getDatabase(firebaseApp);


/* ==========================================================================
   SECTION 1: APP STATE
   We still keep a local JavaScript object as our "working copy" of the
   data — but now it gets FILLED from Firebase in real time, instead of
   from localStorage. Whenever the database changes (even from someone
   else's browser!), Firebase automatically calls our listener functions
   and we redraw the screen. This is called "realtime sync".
   ========================================================================== */

let appState = {
  people: {},               // object of { uid: personData }, filled live from Firebase
  requests: {},             // object of { requestId: requestData }, filled live
  currentUser: null,         // the Firebase User object once logged in, else null
  activeCall: null,          // { callId, otherPersonId, isCaller } while a call is happening
  activeChatPartnerId: null, // UID of user currently chatting with
  currentChatListener: null, // RTDB listener for active chat messages
  lastCallKey: null          // Firebase key of last logged call history
};

const AVATAR_OPTIONS = ['🙂', '😎', '🧑‍🎨', '👩‍💻', '🧑‍🍳', '🧘', '🎸', '📸', '🧑‍🏫', '🌸', '🦊', '🐼'];


/* ==========================================================================
   SECTION 2: AUTHENTICATION
   Firebase watches the login state for us. onAuthStateChanged fires
   automatically: once when the page loads (telling us if a session is
   already saved in the browser), and again every time someone logs in
   or out. This is the heart of the whole app's "am I logged in?" logic.
   ========================================================================== */

function setupAuthListener() {
  onAuthStateChanged(auth, (user) => {
    appState.currentUser = user; // null if logged out, a User object if logged in
    updateNavForAuthState();

    if (user) {
      // Logged in — track online presence and start listening to the live database
      setupPresence(user.uid);
      listenToPeople();
      listenToRequests();
      listenForIncomingCalls(user.uid);
    }
  });
}

function setupPresence(uid) {
  const connectedRef = ref(db, '.info/connected');
  const presenceRef = ref(db, `people/${uid}/presence`);

  onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === true) {
      // Set to offline when socket disconnects
      onDisconnect(presenceRef).set({
        online: false,
        lastChanged: serverTimestamp()
      });
      // Mark as online right now
      set(presenceRef, {
        online: true,
        lastChanged: serverTimestamp()
      });
    }
  });
}

function isUserOnline(person) {
  if (!person || !person.presence) return false;
  return person.presence.online === true;
}

function renderOnlineBadge(person) {
  const online = isUserOnline(person);
  return `
    <span class="online-badge ${online ? 'online' : 'offline'}">
      <span class="status-dot ${online ? 'online' : 'offline'}"></span>
      ${online ? 'Online' : 'Offline'}
    </span>
  `;
}

function updateNavForAuthState() {
  const loginBtn = document.getElementById('navLoginBtn');
  const logoutBtn = document.getElementById('navLogoutBtn');

  if (appState.currentUser) {
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
  } else {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
  }
}

// ==========================================================================
// EMAIL VALIDATION & REAL-WORLD EXISTENCE VERIFICATION SYSTEM
// ==========================================================================

// Pre-approved list of major email providers that definitely exist (0ms instant fast-path)
const KNOWN_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.fr', 'yahoo.de',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'zoho.com', 'mail.com', 'gmx.com', 'gmx.net',
  'yandex.com', 'yandex.ru', 'fastmail.com', 'tutanota.com', 'tuta.com', 'hey.com'
]);

// Common domain typos to detect and offer 1-click auto-correction
const COMMON_DOMAIN_TYPOS = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaild.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'yaho.in': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outluk.com': 'outlook.com',
  'iclud.com': 'icloud.com',
  'icoud.com': 'icloud.com',
  'prton.me': 'proton.me',
  'protonmai.com': 'proton.me'
};

// Known fake / disposable burner email services
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'mailinator.com', '10minutemail.com', 'guerrillamail.com',
  'throwawaymail.com', 'yopmail.com', 'sharklasers.com', 'trashmail.com',
  'temp-mail.org', 'fakemailgenerator.com', 'dispostable.com', 'getnada.com',
  'mohmal.com', 'burnermail.io', 'mytemp.email', 'crazymailing.com'
]);

// In-memory cache for DNS verified domains so queries run only once per session
const verifiedDomainCache = new Map();

function isValidEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) return false;

  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase();

  if (!domain.includes('.')) return false;
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;

  return true;
}

// Backwards-compatible alias
function isValidEmail(email) {
  return isValidEmailFormat(email);
}

function isEmailAlreadyRegistered(email) {
  if (!email || !appState.people) return false;
  const target = email.trim().toLowerCase();
  return Object.values(appState.people).some(
    p => p.email && p.email.toLowerCase() === target
  );
}

/**
 * Checks whether an email domain actually exists and has mail exchange (MX) capability.
 * Uses DNS-over-HTTPS (Google Public DNS with Cloudflare fallback).
 */
async function verifyEmailDomainExists(domain) {
  const dom = (domain || '').trim().toLowerCase();
  if (!dom) return { exists: false, reason: 'empty' };

  // 1. Check in-memory cache
  if (verifiedDomainCache.has(dom)) {
    return verifiedDomainCache.get(dom);
  }

  // 2. Fast-path: Top verified global providers
  if (KNOWN_EMAIL_PROVIDERS.has(dom)) {
    const res = { exists: true, provider: 'known' };
    verifiedDomainCache.set(dom, res);
    return res;
  }

  // 3. Typo detection
  if (COMMON_DOMAIN_TYPOS[dom]) {
    const res = { exists: false, reason: 'typo', suggestion: COMMON_DOMAIN_TYPOS[dom] };
    verifiedDomainCache.set(dom, res);
    return res;
  }

  // 4. Disposable/burner detection
  if (DISPOSABLE_EMAIL_DOMAINS.has(dom)) {
    const res = { exists: false, reason: 'disposable' };
    verifiedDomainCache.set(dom, res);
    return res;
  }

  // 5. Query DNS-over-HTTPS (Google DNS MX check)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const googleUrl = `https://dns.google/resolve?name=${encodeURIComponent(dom)}&type=MX`;
    const resp = await fetch(googleUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      // Status 3 = NXDOMAIN (Domain does NOT exist on the internet!)
      if (data.Status === 3) {
        const res = { exists: false, reason: 'nxdomain' };
        verifiedDomainCache.set(dom, res);
        return res;
      }

      // Status 0 = NOERROR (Domain exists)
      if (data.Status === 0) {
        if (Array.isArray(data.Answer) && data.Answer.length > 0) {
          // Check for RFC 7505 Null MX (data "0 .", meaning rejects all mail)
          const isNullMx = data.Answer.some(ans => ans.data && ans.data.trim() === '0 .');
          if (isNullMx) {
            const res = { exists: false, reason: 'no_mail_accepted' };
            verifiedDomainCache.set(dom, res);
            return res;
          }
          const res = { exists: true, provider: 'mx_record' };
          verifiedDomainCache.set(dom, res);
          return res;
        }

        // Domain exists in DNS but had no MX records; per RFC 5321, check fallback A record
        try {
          const aResp = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(dom)}&type=A`);
          if (aResp.ok) {
            const aData = await aResp.json();
            if (aData.Status === 0 && Array.isArray(aData.Answer) && aData.Answer.length > 0) {
              const res = { exists: true, provider: 'a_record_fallback' };
              verifiedDomainCache.set(dom, res);
              return res;
            }
          }
        } catch (e) {}

        const res = { exists: false, reason: 'no_mx' };
        verifiedDomainCache.set(dom, res);
        return res;
      }
    }
  } catch (err) {
    // Attempt fallback to Cloudflare DNS-over-HTTPS
    try {
      const cfResp = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dom)}&type=MX`, {
        headers: { Accept: 'application/dns-json' }
      });
      if (cfResp.ok) {
        const cfData = await cfResp.json();
        if (cfData.Status === 3) {
          const res = { exists: false, reason: 'nxdomain' };
          verifiedDomainCache.set(dom, res);
          return res;
        }
        if (cfData.Status === 0 && Array.isArray(cfData.Answer) && cfData.Answer.length > 0) {
          const res = { exists: true, provider: 'cloudflare_mx' };
          verifiedDomainCache.set(dom, res);
          return res;
        }
      }
    } catch (cfErr) {
      console.warn('DNS verification offline/fallback:', cfErr);
    }
  }

  // Graceful fallback if network is offline
  return { exists: true, provider: 'unverified_fallback' };
}

/**
 * Full Email Existence & Deliverability Validator
 */
async function validateEmailExistence(email, options = {}) {
  const { isSignUp = true } = options;
  const trimmed = (email || '').trim();

  // 1. Syntax Check
  if (!isValidEmailFormat(trimmed)) {
    return {
      valid: false,
      status: 'invalid',
      message: 'Please enter a valid email address (e.g. name@domain.com)'
    };
  }

  const [username, domain] = trimmed.split('@');

  // 2. Check for domain typos (e.g. gmial.com)
  const typoCorrection = COMMON_DOMAIN_TYPOS[domain.toLowerCase()];
  if (typoCorrection) {
    const suggestedEmail = `${username}@${typoCorrection}`;
    return {
      valid: false,
      status: 'typo',
      suggestedEmail,
      message: `Did you mean <strong>${suggestedEmail}</strong>?`
    };
  }

  // 3. Check for disposable burner email
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain.toLowerCase())) {
    return {
      valid: false,
      status: 'disposable',
      message: 'Temporary or disposable email domains are not allowed.'
    };
  }

  // 4. Verify whether the domain actually exists on the internet
  const domainCheck = await verifyEmailDomainExists(domain);
  if (!domainCheck.exists) {
    if (domainCheck.reason === 'nxdomain') {
      return {
        valid: false,
        status: 'nxdomain',
        message: `Email domain <strong>@${domain}</strong> does not exist on the internet.`
      };
    }
    if (domainCheck.reason === 'no_mx' || domainCheck.reason === 'no_mail_accepted') {
      return {
        valid: false,
        status: 'no_mx',
        message: `Domain <strong>@${domain}</strong> cannot receive emails (no mail server found).`
      };
    }
  }

  // 5. Account Existence in SkillSwap
  const alreadyRegistered = isEmailAlreadyRegistered(trimmed);
  if (isSignUp && alreadyRegistered) {
    return {
      valid: false,
      status: 'already_registered',
      message: 'An account with this email already exists. Please log in.'
    };
  }

  if (!isSignUp) {
    if (!alreadyRegistered) {
      return {
        valid: true, // Allow form submit so Firebase can still authenticate or report exact credentials error
        status: 'account_not_found',
        message: 'No account registered with this email. Please check spelling or create a profile.'
      };
    }
    return {
      valid: true,
      status: 'account_found',
      message: 'Account found! Enter your password.'
    };
  }

  return {
    valid: true,
    status: 'verified',
    message: 'Valid email address & active mail server verified!'
  };
}

function setupEmailValidationFeedback() {
  const fields = [
    { inputId: 'suEmail', iconId: 'suEmailStatusIcon', feedbackId: 'suEmailFeedback', checkExisting: true },
    { inputId: 'liEmail', iconId: 'liEmailStatusIcon', feedbackId: 'liEmailFeedback', checkExisting: false }
  ];

  fields.forEach(({ inputId, iconId, feedbackId, checkExisting }) => {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    const feedback = document.getElementById(feedbackId);
    if (!input || !feedback) return;

    let debounceTimer = null;
    let currentCheckId = 0;

    const performValidation = async () => {
      const val = input.value.trim();
      if (!val) {
        input.classList.remove('input-valid', 'input-invalid');
        if (icon) icon.textContent = '';
        feedback.className = 'email-validation-feedback';
        feedback.innerHTML = '';
        return;
      }

      // Initial quick syntax check
      if (!isValidEmailFormat(val)) {
        if (val.length >= 3) {
          input.classList.add('input-invalid');
          input.classList.remove('input-valid');
          if (icon) {
            icon.textContent = '✕';
            icon.style.color = '#DC2626';
          }
          feedback.className = 'email-validation-feedback invalid';
          feedback.innerHTML = '<span>✕</span> Please enter a valid email address (e.g. name@domain.com)';
        }
        return;
      }

      // Show verifying loading indicator while querying DNS
      const thisCheckId = ++currentCheckId;
      if (icon) {
        icon.textContent = '⏳';
        icon.style.color = '#6B7280';
      }
      feedback.className = 'email-validation-feedback checking';
      feedback.innerHTML = '<span>⏳</span> Verifying email domain existence...';

      const result = await validateEmailExistence(val, { isSignUp: checkExisting });

      // Discard if user continued typing another value
      if (thisCheckId !== currentCheckId) return;

      if (result.status === 'typo') {
        input.classList.add('input-invalid');
        input.classList.remove('input-valid');
        if (icon) {
          icon.textContent = '💡';
          icon.style.color = '#2563EB';
        }
        feedback.className = 'email-validation-feedback warning';
        feedback.innerHTML = `<span>💡</span> Did you mean <strong>${result.suggestedEmail}</strong>? <button type="button" class="email-typo-suggestion" data-fix="${result.suggestedEmail}">Fix</button>`;

        const fixBtn = feedback.querySelector('.email-typo-suggestion');
        if (fixBtn) {
          fixBtn.addEventListener('click', () => {
            input.value = result.suggestedEmail;
            performValidation();
          });
        }
        return;
      }

      if (!result.valid) {
        input.classList.add('input-invalid');
        input.classList.remove('input-valid');
        if (icon) {
          icon.textContent = '✕';
          icon.style.color = '#DC2626';
        }
        feedback.className = 'email-validation-feedback invalid';
        feedback.innerHTML = `<span>✕</span> ${result.message}`;
        return;
      }

      if (result.status === 'account_not_found') {
        input.classList.add('input-invalid');
        input.classList.remove('input-valid');
        if (icon) {
          icon.textContent = '⚠️';
          icon.style.color = '#D97706';
        }
        feedback.className = 'email-validation-feedback warning';
        feedback.innerHTML = `<span>⚠️</span> ${result.message}`;
        return;
      }

      // Successful verification
      input.classList.add('input-valid');
      input.classList.remove('input-invalid');
      if (icon) {
        icon.textContent = '✓';
        icon.style.color = '#059669';
      }
      feedback.className = 'email-validation-feedback valid';
      feedback.innerHTML = `<span>✓</span> ${result.message}`;
    };

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(performValidation, 350);
    });

    input.addEventListener('blur', () => {
      clearTimeout(debounceTimer);
      performValidation();
    });
  });
}

// SIGN UP: creates a real Firebase account, then saves a matching
// profile document in the database under people/<their new uid>
function setupSignupForm() {
  const form = document.getElementById('signupForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = document.getElementById('signupNote');
    note.classList.remove('error');

    const emailInput = document.getElementById('suEmail');
    const email = emailInput.value.trim();
    const password = document.getElementById('suPassword').value;
    const name = document.getElementById('regName').value.trim();
    const avatar = document.getElementById('regAvatar').value;
    const bio = document.getElementById('regBio').value.trim() || 'No bio yet.';
    const teachSkill = document.getElementById('regTeach').value.trim();
    const learnSkill = document.getElementById('regLearn').value.trim();

    // 1. Strict Email Validity & Existence Check
    note.textContent = 'Verifying email existence...';
    const emailCheck = await validateEmailExistence(email, { isSignUp: true });
    if (!emailCheck.valid) {
      emailInput.focus();
      emailInput.classList.add('input-invalid');
      note.classList.add('error');
      note.innerHTML = `⚠️ ${emailCheck.message}`;
      return;
    }

    // 3. Password length check
    if (password.length < 6) {
      document.getElementById('suPassword').focus();
      note.classList.add('error');
      note.textContent = '⚠️ Password must be at least 6 characters.';
      return;
    }

    note.textContent = 'Creating your account...';

    try {
      // Step 1: create the login credentials with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid; // Firebase generates this unique ID for us

      // Step 2: send email verification link so user can verify mailbox actually exists
      try {
        await sendEmailVerification(userCredential.user);
      } catch (verifErr) {
        console.warn('Could not dispatch verification email immediately:', verifErr);
      }

      // Step 3: save their profile info in the Realtime Database,
      // filed under their own uid so we always know whose data it is
      const newPerson = {
        name,
        avatar,
        bio,
        email: email.toLowerCase(),
        emailVerified: false,
        teach: [{ name: teachSkill, category: 'other' }],
        learn: [{ name: learnSkill, category: 'other' }],
        rating: 0,
        ratingCount: 0,
        hoursTaught: 0,
        skillsTaughtCount: 0,
        skillsLearnedCount: 0,
        history: {}
      };

      await set(ref(db, 'people/' + uid), newPerson);

      showToast(`🎉 Welcome, ${name}! Profile created. A verification email was sent to ${email}.`);
      form.reset();
      goToPage('dashboard');

    } catch (error) {
      // Firebase gives us readable error messages — e.g. "email already in use"
      note.classList.add('error');
      note.textContent = friendlyAuthError(error);
    }
  });
}

// LOG IN: just checks the email/password against Firebase Auth.
// Once successful, onAuthStateChanged (above) fires automatically.
function setupLoginForm() {
  const form = document.getElementById('loginForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = document.getElementById('loginNote');
    note.classList.remove('error');

    const emailInput = document.getElementById('liEmail');
    const email = emailInput.value.trim();
    const password = document.getElementById('liPassword').value;

    note.textContent = 'Verifying email & logging in...';
    const emailCheck = await validateEmailExistence(email, { isSignUp: false });
    if (!emailCheck.valid) {
      emailInput.focus();
      emailInput.classList.add('input-invalid');
      note.classList.add('error');
      note.innerHTML = `⚠️ ${emailCheck.message}`;
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      note.textContent = '';
      form.reset();
      goToPage('dashboard');
      showToast('👋 Welcome back!');
    } catch (error) {
      note.classList.add('error');
      note.textContent = friendlyAuthError(error);
    }
  });
}

function setupLogout() {
  document.getElementById('navLogoutBtn').addEventListener('click', async () => {
    if (appState.currentUser) {
      try {
        await set(ref(db, `people/${appState.currentUser.uid}/presence`), {
          online: false,
          lastChanged: serverTimestamp()
        });
      } catch (e) {}
    }
    await signOut(auth);
    showToast('You have been logged out.');
    goToPage('home');
  });
}

// Converts Firebase's technical error codes into plain English
function friendlyAuthError(error) {
  const code = error.code || '';
  if (code.includes('email-already-in-use')) return '⚠️ An account with this email already exists — try logging in instead.';
  if (code.includes('invalid-email')) return '⚠️ That email address is not valid or does not exist.';
  if (code.includes('weak-password')) return '⚠️ Password should be at least 6 characters.';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return '⚠️ Incorrect email or password.';
  }
  return 'Something went wrong: ' + error.message;
}


/* ==========================================================================
   SECTION 3: REALTIME DATABASE LISTENERS
   onValue() is the key Firebase function here: it "subscribes" us to a
   piece of data. It runs immediately with the current data, AND it runs
   again automatically every single time that data changes — even if the
   change came from a totally different person's browser. This is what
   makes browsing, requests, and dashboards update live for everyone.
   ========================================================================== */

function listenToPeople() {
  const peopleRef = ref(db, 'people');
  onValue(peopleRef, (snapshot) => {
    appState.people = snapshot.val() || {};
    // Redraw whichever screens depend on the people list
    renderHomeStats();
    renderPeopleGrid();
    renderDashboard();
  });
}

function listenToRequests() {
  const requestsRef = ref(db, 'requests');
  onValue(requestsRef, (snapshot) => {
    appState.requests = snapshot.val() || {};
    renderRequests();
  });
}


/* ==========================================================================
   SECTION 4: PAGE NAVIGATION (unchanged logic from the original version)
   ========================================================================== */

function goToPage(pageName) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  const target = document.getElementById('page-' + pageName);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageName);
  });

  document.getElementById('navLinks').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (pageName === 'browse') renderPeopleGrid();
  if (pageName === 'requests') renderRequests();
  if (pageName === 'chat') renderChatPage();
  if (pageName === 'dashboard') renderDashboard();
  if (pageName === 'home') renderHomeStats();
}

function setupNavigation() {
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Guard certain pages behind login
      const protectedPages = ['requests', 'dashboard', 'chat'];
      if (protectedPages.includes(btn.dataset.page) && !appState.currentUser) {
        showToast('⚠️ Please log in first!');
        goToPage('login');
        return;
      }
      goToPage(btn.dataset.page);
    });
  });

  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });
}


/* ==========================================================================
   SECTION 5: HOME PAGE — stats & popular tags
   ========================================================================== */

function renderHomeStats() {
  const peopleList = Object.values(appState.people);
  const totalSkills = peopleList.reduce((sum, p) => sum + (p.teach ? p.teach.length : 0), 0);
  const totalHours = peopleList.reduce((sum, p) => sum + (p.hoursTaught || 0), 0);

  animateNumber('statUsers', peopleList.length);
  animateNumber('statSkills', totalSkills);
  animateNumber('statHours', Math.round(totalHours));

  const allSkillNames = peopleList.flatMap(p => (p.teach || []).map(s => s.name));
  const uniqueSkills = [...new Set(allSkillNames)].slice(0, 10);

  const tagCloud = document.getElementById('popularTags');
  tagCloud.innerHTML = uniqueSkills.map(name =>
    `<button class="tag-pill" data-skill="${name}">${name}</button>`
  ).join('');

  tagCloud.querySelectorAll('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      goToPage('browse');
      document.getElementById('searchInput').value = pill.dataset.skill;
      renderPeopleGrid();
    });
  });
}

function animateNumber(elementId, targetValue) {
  const el = document.getElementById(elementId);
  let current = 0;
  const step = Math.max(1, Math.ceil(targetValue / 30));
  const interval = setInterval(() => {
    current += step;
    if (current >= targetValue) { current = targetValue; clearInterval(interval); }
    el.textContent = current;
  }, 30);
}


/* ==========================================================================
   SECTION 6: SIGN UP FORM — avatar picker (unchanged from original)
   ========================================================================== */

function setupAvatarPicker() {
  const picker = document.getElementById('avatarPicker');
  picker.innerHTML = AVATAR_OPTIONS.map((emoji, i) =>
    `<div class="avatar-option ${i === 0 ? 'selected' : ''}" data-emoji="${emoji}">${emoji}</div>`
  ).join('');

  picker.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      picker.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('regAvatar').value = opt.dataset.emoji;
    });
  });
}


/* ==========================================================================
   SECTION 7: BROWSE PAGE — showing all people as cards, with search & filter
   ========================================================================== */

function renderPeopleGrid() {
  const grid = document.getElementById('peopleGrid');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filterCategory = document.getElementById('filterSelect').value;

  const myUid = appState.currentUser ? appState.currentUser.uid : null;

  // Convert the {uid: data} object into an array of {id, ...data} so it's
  // easy to filter and map, same as the old localStorage version
  let peopleToShow = Object.entries(appState.people)
    .filter(([uid]) => uid !== myUid)
    .map(([uid, data]) => ({ id: uid, ...data }));

  if (searchTerm) {
    peopleToShow = peopleToShow.filter(p =>
      (p.teach || []).some(s => s.name.toLowerCase().includes(searchTerm)) ||
      p.name.toLowerCase().includes(searchTerm)
    );
  }

  if (filterCategory !== 'all') {
    peopleToShow = peopleToShow.filter(p =>
      (p.teach || []).some(s => s.category === filterCategory)
    );
  }

  if (peopleToShow.length === 0) {
    grid.innerHTML = `<div class="empty-state"><span>🔍</span>No matches found yet. Try a different search, or be the first to add this skill!</div>`;
    return;
  }

  grid.innerHTML = peopleToShow.map(person => `
    <div class="person-card">
      <div class="person-top">
        <div class="person-avatar">${person.avatar}</div>
        <div style="flex: 1; min-width: 0;">
          <div class="person-header-row">
            <div class="person-name">${person.name}</div>
            ${renderOnlineBadge(person)}
          </div>
          <div class="person-rating">
            <span class="stars">${starString(person.rating || 0)}</span>
            ${person.rating > 0 ? `${person.rating.toFixed(1)} (${person.ratingCount})` : 'New member'}
          </div>
        </div>
      </div>
      <p class="person-bio">${person.bio}</p>
      <div class="skill-badges">
        ${(person.teach || []).map(s => `<div class="skill-badge skill-badge-teach"><span class="skill-badge-icon">📚</span>Teaches ${s.name}</div>`).join('')}
        ${(person.learn || []).map(s => `<div class="skill-badge skill-badge-learn"><span class="skill-badge-icon">🎯</span>Wants to learn ${s.name}</div>`).join('')}
      </div>
      <div style="display:flex; gap:0.6rem; align-items:center;">
        <button class="btn btn-ghost btn-small person-chat-btn" data-person-id="${person.id}" title="Send message" style="padding:0.7rem 0.9rem; font-size:1rem;">💬</button>
        <button class="btn btn-primary request-btn" style="flex:1;" data-person-id="${person.id}">Send swap request</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.request-btn').forEach(btn => {
    btn.addEventListener('click', () => sendSwapRequest(btn.dataset.personId));
  });

  grid.querySelectorAll('.person-chat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!appState.currentUser) {
        showToast('⚠️ Please log in first!');
        goToPage('login');
        return;
      }
      openChatWith(btn.dataset.personId);
    });
  });
}

function starString(rating) {
  const rounded = Math.round(rating);
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

function setupBrowseFilters() {
  document.getElementById('searchInput').addEventListener('input', renderPeopleGrid);
  document.getElementById('filterSelect').addEventListener('change', renderPeopleGrid);
}

// SEND REQUEST: writes a new record to requests/ in the database.
// push() asks Firebase to generate a unique random ID for it — like a
// numbered ticket — so two requests can never collide with the same ID.
async function sendSwapRequest(targetPersonId) {
  if (!appState.currentUser) {
    showToast('⚠️ Please log in first!');
    goToPage('login');
    return;
  }

  const myUid = appState.currentUser.uid;
  const me = appState.people[myUid];
  const targetPerson = appState.people[targetPersonId];

  const newRequest = {
    fromId: myUid,
    toId: targetPersonId,
    teachSkill: me.teach?.[0]?.name || 'a skill',
    learnSkill: targetPerson.teach?.[0]?.name || 'a skill',
    status: 'pending',
    createdAt: serverTimestamp() // Firebase fills in the exact server time for us
  };

  const requestsListRef = ref(db, 'requests');
  const newRequestRef = push(requestsListRef); // generates a unique ID
  await set(newRequestRef, newRequest);

  showToast(`✅ Request sent to ${targetPerson.name}!`);
}


/* ==========================================================================
   SECTION 8: REQUESTS PAGE — incoming / outgoing / accepted tabs
   ========================================================================== */

function setupRequestTabs() {
  document.querySelectorAll('.tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');
      document.querySelectorAll('.requests-list').forEach(list => list.classList.add('hidden'));
      document.getElementById(tabBtn.dataset.tab + 'List').classList.remove('hidden');
    });
  });
}

function renderRequests() {
  const listIds = ['incomingList', 'outgoingList', 'acceptedList'];

  if (!appState.currentUser) {
    listIds.forEach(id => {
      document.getElementById(id).innerHTML = `<div class="empty-state"><span>👋</span>Log in to see your requests.</div>`;
    });
    return;
  }

  const myId = appState.currentUser.uid;

  // Same trick as before: turn {id: data} into an array of {id, ...data}
  const allRequests = Object.entries(appState.requests).map(([id, data]) => ({ id, ...data }));

  const incoming = allRequests.filter(r => r.toId === myId && r.status === 'pending');
  const outgoing = allRequests.filter(r => r.fromId === myId && r.status === 'pending');
  const accepted = allRequests.filter(r => r.status === 'accepted' && (r.fromId === myId || r.toId === myId));

  document.getElementById('incomingCount').textContent = incoming.length;
  document.getElementById('outgoingCount').textContent = outgoing.length;
  document.getElementById('acceptedCount').textContent = accepted.length;

  renderRequestList('incomingList', incoming, 'incoming');
  renderRequestList('outgoingList', outgoing, 'outgoing');
  renderRequestList('acceptedList', accepted, 'accepted');
}

function renderRequestList(containerId, list, type) {
  const container = document.getElementById(containerId);

  if (list.length === 0) {
    const messages = {
      incoming: 'No incoming requests yet. Keep your profile updated!',
      outgoing: "You haven't sent any requests yet. Go browse some skills!",
      accepted: 'No active swaps yet. Accept a request to get started.'
    };
    container.innerHTML = `<div class="empty-state"><span>📭</span>${messages[type]}</div>`;
    return;
  }

  const myId = appState.currentUser.uid;

  container.innerHTML = list.map(req => {
    const otherPersonId = req.fromId === myId ? req.toId : req.fromId;
    const otherPerson = appState.people[otherPersonId];
    if (!otherPerson) return ''; // safety check in case data is still loading

    let actionsHtml = '';
    if (type === 'incoming') {
      actionsHtml = `
        <button class="btn btn-primary btn-small" data-action="accept" data-req="${req.id}">Accept</button>
        <button class="btn btn-ghost btn-small" data-action="decline" data-req="${req.id}">Decline</button>`;
    } else if (type === 'outgoing') {
      actionsHtml = `<span class="status-pill status-pending">Waiting for response</span>`;
    } else if (type === 'accepted') {
      actionsHtml = `
        <button class="btn btn-ghost btn-small" data-action="chat" data-other="${otherPersonId}">💬 Chat</button>
        <button class="btn btn-primary btn-small" data-action="call" data-req="${req.id}" data-other="${otherPersonId}">📹 Start video call</button>
      `;
    }

    return `
      <div class="request-card">
        <div class="request-avatar">${otherPerson.avatar}</div>
        <div class="request-info">
          <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
            <strong>${otherPerson.name}</strong>
            ${renderOnlineBadge(otherPerson)}
          </div>
          <p>You teach <b>${req.teachSkill}</b> ⇄ You learn <b>${req.learnSkill}</b></p>
        </div>
        ${type === 'accepted' ? '<span class="status-pill status-accepted">Active swap</span>' : ''}
        <div class="request-actions">${actionsHtml}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleRequestAction(btn.dataset.action, btn.dataset.req, btn.dataset.other));
  });
}

// ACCEPT / DECLINE just update a single field in the database.
// update() changes only the fields you list, without touching the rest.
async function handleRequestAction(action, requestId, otherPersonId) {
  if (action === 'accept') {
    await update(ref(db, 'requests/' + requestId), { status: 'accepted' });
    showToast('🤝 Swap accepted! You can now start a video call.');
  } else if (action === 'decline') {
    await update(ref(db, 'requests/' + requestId), { status: 'declined' });
    showToast('Request declined.');
  } else if (action === 'call') {
    startOutgoingCall(requestId, otherPersonId);
  } else if (action === 'chat') {
    openChatWith(otherPersonId);
  }
}


/* ==========================================================================
   SECTION 9: VIDEO CALLING WITH WEBRTC + FIREBASE SIGNALING
   --------------------------------------------------------------------------
   This is the most technical part of the app, so here's the big picture
   before the code:

   WebRTC lets two browsers send video/audio directly to each other
   (peer-to-peer), which is fast and doesn't need a video server. BUT,
   before that direct connection can start, the two browsers need to
   exchange some setup information:

     - An "offer" (from the person starting the call): "Here's how you
       can reach me, and here's what audio/video formats I support."
     - An "answer" (from the person receiving the call): "Got it, here's
       how you can reach ME, and here's what I support."
     - "ICE candidates": extra little notes both sides send about
       possible network paths to reach each other (handles things like
       WiFi vs mobile data, routers, etc.)

   This exchange is called SIGNALING, and WebRTC does NOT provide a
   built-in way to do it — you have to build your own "mailbox" for
   passing these messages. We use a Realtime Database path like:

       calls/<callId>/offer
       calls/<callId>/answer
       calls/<callId>/callerCandidates/...
       calls/<callId>/calleeCandidates/...

   Once both sides have exchanged this info, WebRTC connects them
   DIRECTLY — the video itself never touches our Firebase database,
   only these small text messages do.
   ========================================================================== */

// Free public STUN server — helps each browser discover its own public
// address so the other browser can find a way to reach it. This is
// standard, free infrastructure that most WebRTC apps use.
const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

let peerConnection = null;
let localStream = null;
let currentCallId = null;
let callTimeoutTimer = null;

// Browser synthesized ringtone chime for incoming calls (Web Audio API)
let ringtoneAudioCtx = null;
let ringtoneInterval = null;

function startRingtone() {
  stopRingtone();
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    ringtoneAudioCtx = new AudioContextClass();
    
    const playChime = () => {
      try {
        if (!ringtoneAudioCtx) return;
        if (ringtoneAudioCtx.state === 'suspended') {
          ringtoneAudioCtx.resume();
        }
        const now = ringtoneAudioCtx.currentTime;
        const osc = ringtoneAudioCtx.createOscillator();
        const gain = ringtoneAudioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
        
        osc.connect(gain);
        gain.connect(ringtoneAudioCtx.destination);
        
        osc.start(now);
        osc.stop(now + 0.6);
      } catch (e) {}
    };

    playChime();
    ringtoneInterval = setInterval(playChime, 2200);
  } catch (e) {}
}

function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (ringtoneAudioCtx) {
    try { ringtoneAudioCtx.close(); } catch (e) {}
    ringtoneAudioCtx = null;
  }
}

// STARTING A CALL (I am the "caller")
async function startOutgoingCall(requestId, otherPersonId) {
  const myId = appState.currentUser.uid;
  const me = appState.people[myId] || {};
  const otherPerson = appState.people[otherPersonId] || {};

  // Create a fresh, unique ID for this call session in the database
  const callRef = push(ref(db, 'calls'));
  currentCallId = callRef.key;

  appState.activeCall = { callId: currentCallId, otherPersonId, requestId, isCaller: true, connected: false };

  await openVideoModal(otherPersonId);
  document.getElementById('videoStatus').textContent = `Calling ${otherPerson.name || 'partner'}...`;

  peerConnection = new RTCPeerConnection(RTC_CONFIG);
  attachLocalStreamToConnection();
  listenForRemoteTrack();

  const callerCandidatesRef = ref(db, `calls/${currentCallId}/callerCandidates`);
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentCallId) {
      push(callerCandidatesRef, event.candidate.toJSON()).catch(() => {});
    }
  };

  // 1. Write the initial call record FIRST
  await set(callRef, {
    callerId: myId,
    callerName: me.name || 'Someone',
    callerAvatar: me.avatar || '🙂',
    calleeId: otherPersonId,
    status: 'ringing',
    createdAt: Date.now()
  });

  // 2. Direct user-targeted notification mailbox: incomingCalls/{otherPersonId}
  try {
    await set(ref(db, `incomingCalls/${otherPersonId}`), {
      callId: currentCallId,
      callerId: myId,
      callerName: me.name || 'Someone',
      callerAvatar: me.avatar || '🙂',
      status: 'ringing',
      createdAt: Date.now()
    });
  } catch (e) {
    console.warn('Notice setting incomingCalls mailbox:', e);
  }

  // 3. Create WebRTC offer and set local description
  const offerDescription = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offerDescription);

  // 4. Update the call record with the offer (preserves child candidate nodes)
  await update(callRef, {
    offer: { type: offerDescription.type, sdp: offerDescription.sdp }
  });

  // 5. Listen for callee's answer, decline, or remote end
  const callStatusRef = ref(db, `calls/${currentCallId}`);
  onValue(callStatusRef, async (snapshot) => {
    const callData = snapshot.val();
    if (!callData) return;

    if (callData.status === 'declined') {
      showToast(`📞 ${otherPerson.name || 'Partner'} is unavailable / declined.`);
      endVideoCall(false);
      return;
    }

    if (callData.status === 'ended') {
      showToast('Call ended.');
      endVideoCall(true);
      return;
    }

    if (callData.answer && peerConnection && !peerConnection.currentRemoteDescription) {
      try {
        const answerDescription = new RTCSessionDescription(callData.answer);
        await peerConnection.setRemoteDescription(answerDescription);
        if (appState.activeCall) appState.activeCall.connected = true;
        document.getElementById('videoStatus').textContent = 'Connected!';
        if (callTimeoutTimer) {
          clearTimeout(callTimeoutTimer);
          callTimeoutTimer = null;
        }
      } catch (e) {
        console.warn('Error setting remote description:', e);
      }
    }
  });

  // 6. Listen for the callee's ICE candidates
  onValue(ref(db, `calls/${currentCallId}/calleeCandidates`), (snapshot) => {
    const candidates = snapshot.val();
    if (!candidates || !peerConnection) return;
    Object.values(candidates).forEach(async (candidateData) => {
      try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)); }
      catch (e) {}
    });
  });

  // 7. Auto-timeout after 50 seconds if unanswered
  if (callTimeoutTimer) clearTimeout(callTimeoutTimer);
  callTimeoutTimer = setTimeout(async () => {
    if (appState.activeCall && !appState.activeCall.connected) {
      showToast(`⏱️ No answer from ${otherPerson.name || 'partner'}.`);
      try {
        await update(ref(db, `calls/${currentCallId}`), { status: 'timeout' });
        await remove(ref(db, `incomingCalls/${otherPersonId}`));
      } catch (e) {}
      endVideoCall(false);
    }
  }, 50000);
}

// RECEIVING A CALL (I am the "callee")
// Listens to direct incomingCalls/{myUid} mailbox and /calls as fallback
function listenForIncomingCalls(myUid) {
  // Primary: direct user mailbox
  const myIncomingRef = ref(db, `incomingCalls/${myUid}`);
  onValue(myIncomingRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      if (!document.getElementById('incomingCallModal').classList.contains('hidden') && !appState.activeCall) {
        document.getElementById('incomingCallModal').classList.add('hidden');
        stopRingtone();
      }
      return;
    }

    if (appState.activeCall) return;

    if (data.status === 'ringing') {
      if (data.createdAt && Date.now() - data.createdAt > 90000) {
        remove(myIncomingRef).catch(() => {});
        return;
      }
      showIncomingCallPopup(data.callId, data.callerId, data.callerName, data.callerAvatar);
    } else {
      document.getElementById('incomingCallModal').classList.add('hidden');
      stopRingtone();
    }
  }, (error) => {
    console.warn('incomingCalls mailbox notice:', error.message);
  });

  // Secondary fallback: scan calls node
  try {
    const callsRef = ref(db, 'calls');
    onValue(callsRef, (snapshot) => {
      const allCalls = snapshot.val() || {};
      if (appState.activeCall) return;

      for (const [callId, callData] of Object.entries(allCalls)) {
        if (callData.calleeId === myUid && callData.status === 'ringing') {
          if (callData.createdAt && Date.now() - callData.createdAt > 90000) {
            continue;
          }
          showIncomingCallPopup(callId, callData.callerId, callData.callerName, callData.callerAvatar);
          break;
        }
      }
    }, (error) => {
      // Gracefully ignored if parent /calls read permission is restricted by rules
    });
  } catch (err) {
    console.warn('Calls fallback error:', err);
  }
}

function showIncomingCallPopup(callId, callerId, callerNameFallback, callerAvatarFallback) {
  if (appState.activeCall) return;

  const caller = appState.people[callerId];
  const name = caller?.name || callerNameFallback || 'A community member';
  const avatar = caller?.avatar || callerAvatarFallback || '📹';

  const avatarEl = document.getElementById('incomingCallAvatar');
  if (avatarEl) avatarEl.textContent = avatar;

  document.getElementById('incomingCallText').textContent = `📹 ${name} is calling you!`;
  const subEl = document.getElementById('incomingCallSub');
  if (subEl) subEl.textContent = `${name} wants to start your live video swap session.`;

  document.getElementById('incomingCallModal').classList.remove('hidden');
  startRingtone();
  showToast(`📹 Incoming call from ${name}!`);

  const acceptBtn = document.getElementById('acceptCallBtn');
  const declineBtn = document.getElementById('declineCallBtn');

  // Replace buttons with fresh clones each time to avoid stacking duplicate listeners
  const newAcceptBtn = acceptBtn.cloneNode(true);
  acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
  const newDeclineBtn = declineBtn.cloneNode(true);
  declineBtn.parentNode.replaceChild(newDeclineBtn, declineBtn);

  newAcceptBtn.addEventListener('click', () => {
    stopRingtone();
    document.getElementById('incomingCallModal').classList.add('hidden');
    answerIncomingCall(callId, callerId, name);
  });

  newDeclineBtn.addEventListener('click', async () => {
    stopRingtone();
    document.getElementById('incomingCallModal').classList.add('hidden');
    try {
      await update(ref(db, `calls/${callId}`), { status: 'declined' });
    } catch (e) {}
    try {
      await remove(ref(db, `incomingCalls/${appState.currentUser.uid}`));
    } catch (e) {}
    showToast('Call declined.');
  });
}

async function answerIncomingCall(callId, callerId, callerNameFallback) {
  currentCallId = callId;
  appState.activeCall = { callId, otherPersonId: callerId, isCaller: false, connected: true };

  await openVideoModal(callerId);
  document.getElementById('videoStatus').textContent = 'Connecting...';

  peerConnection = new RTCPeerConnection(RTC_CONFIG);
  attachLocalStreamToConnection();
  listenForRemoteTrack();

  const calleeCandidatesRef = ref(db, `calls/${callId}/calleeCandidates`);
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentCallId) {
      push(calleeCandidatesRef, event.candidate.toJSON()).catch(() => {});
    }
  };

  try {
    const callSnapshot = await get(ref(db, `calls/${callId}`));
    const callData = callSnapshot.val();
    if (!callData || !callData.offer) {
      showToast('⚠️ Call is no longer available.');
      endVideoCall(false);
      return;
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    await update(ref(db, `calls/${callId}`), {
      answer: { type: answerDescription.type, sdp: answerDescription.sdp },
      status: 'connected'
    });

    try {
      await remove(ref(db, `incomingCalls/${appState.currentUser.uid}`));
    } catch (e) {}

    document.getElementById('videoStatus').textContent = 'Connected!';
  } catch (err) {
    console.error('Error answering call:', err);
    showToast('Failed to connect to the call.');
    endVideoCall(false);
    return;
  }

  // Listen for the caller's ICE candidates
  onValue(ref(db, `calls/${callId}/callerCandidates`), (snapshot) => {
    const candidates = snapshot.val();
    if (!candidates || !peerConnection) return;
    Object.values(candidates).forEach(async (candidateData) => {
      try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)); }
      catch (e) {}
    });
  });

  // Listen for remote caller ending the call
  onValue(ref(db, `calls/${callId}/status`), (snapshot) => {
    const status = snapshot.val();
    if (status === 'ended' || status === 'cancelled') {
      showToast('The other person ended the call.');
      endVideoCall(true);
    }
  });
}

// Turns on the user's camera/microphone and shows the video modal.
// getUserMedia is the browser API that asks for camera/mic permission.
async function openVideoModal(otherPersonId) {
  const otherPerson = appState.people[otherPersonId];
  const me = appState.people[appState.currentUser.uid];

  document.getElementById('videoCallTitle').textContent = `Video call with ${otherPerson.name}`;
  document.getElementById('videoTheirName').textContent = otherPerson.name;
  document.getElementById('videoStatus').textContent = 'Requesting camera access...';
  document.getElementById('videoModal').classList.remove('hidden');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    document.getElementById('videoStatus').textContent = 'Waiting for the other person to connect...';
  } catch (error) {
    document.getElementById('videoStatus').textContent =
      '⚠️ Could not access camera/microphone. Please allow permission and try again.';
    showToast('Camera/mic permission is needed for video calls.');
  }

  callSecondsElapsed = 0;
  updateCallTimerDisplay();
  callTimerInterval = setInterval(() => {
    callSecondsElapsed++;
    updateCallTimerDisplay();
  }, 1000);
}

// Adds our camera/mic tracks to the WebRTC connection so the other side
// can receive them
function attachLocalStreamToConnection() {
  if (!localStream) return;
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
}

// When the OTHER person's video/audio arrives, WebRTC fires "ontrack" —
// we take that incoming stream and play it in our remote <video> element
function listenForRemoteTrack() {
  const remoteVideoEl = document.getElementById('remoteVideo');
  const remoteStream = new MediaStream();
  remoteVideoEl.srcObject = remoteStream;

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
    document.getElementById('remoteFallback').classList.add('hidden');
  };
}

let callSecondsElapsed = 0;
let callTimerInterval = null;

function updateCallTimerDisplay() {
  const minutes = String(Math.floor(callSecondsElapsed / 60)).padStart(2, '0');
  const seconds = String(callSecondsElapsed % 60).padStart(2, '0');
  document.getElementById('callTimer').textContent = `${minutes}:${seconds}`;
}

function setupVideoControls() {
  document.getElementById('muteBtn').addEventListener('click', function () {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    this.classList.toggle('muted-active', !audioTrack.enabled);
    this.textContent = audioTrack.enabled ? '🎤' : '🔇';
  });

  document.getElementById('camBtn').addEventListener('click', function () {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    this.classList.toggle('cam-off', !videoTrack.enabled);
    this.textContent = videoTrack.enabled ? '📷' : '📵';
  });

  document.getElementById('endCallBtn').addEventListener('click', endVideoCall);
}

// Cleanly shuts down the call: stops the camera, closes the WebRTC
// connection, removes signaling data from the database, and transitions to rating.
async function endVideoCall(shouldRate = true) {
  if (callTimeoutTimer) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = null;
  }

  clearInterval(callTimerInterval);

  if (localStream) {
    try {
      localStream.getTracks().forEach(track => track.stop());
    } catch (e) {}
    localStream = null;
  }
  if (peerConnection) {
    try {
      peerConnection.close();
    } catch (e) {}
    peerConnection = null;
  }

  const callId = currentCallId;
  const activeCallCopy = appState.activeCall ? { ...appState.activeCall } : null;

  // Signal call ended in database
  if (callId) {
    try {
      await update(ref(db, `calls/${callId}`), { status: 'ended' });
    } catch (e) {}
  }
  try {
    if (appState.currentUser) {
      await remove(ref(db, `incomingCalls/${appState.currentUser.uid}`));
    }
    if (activeCallCopy && activeCallCopy.otherPersonId) {
      await remove(ref(db, `incomingCalls/${activeCallCopy.otherPersonId}`));
    }
  } catch (e) {}

  document.getElementById('videoModal').classList.add('hidden');
  document.getElementById('remoteFallback').classList.remove('hidden');

  const wasConnected = activeCallCopy && (activeCallCopy.connected || callSecondsElapsed > 0);

  // Automatically record the video call in Call History so it's always preserved
  if (wasConnected && activeCallCopy && appState.currentUser) {
    try {
      const otherPerson = appState.people[activeCallCopy.otherPersonId] || {};
      const me = appState.people[appState.currentUser.uid] || {};
      const skillName = otherPerson.teach?.[0]?.name || me.learn?.[0]?.name || 'a skill';
      const durationSecs = callSecondsElapsed || 0;
      const durationText = formatCallDuration(durationSecs);

      const historyRef = push(ref(db, `people/${appState.currentUser.uid}/callHistory`));
      appState.lastCallKey = historyRef.key;

      await set(historyRef, {
        partnerId: activeCallCopy.otherPersonId,
        withWhom: otherPerson.name || 'Partner',
        partnerAvatar: otherPerson.avatar || '🙂',
        skill: skillName,
        durationSecs: durationSecs,
        durationText: durationText,
        hours: Math.max(0.5, Math.round((durationSecs / 3600) * 2) / 2) || 1,
        date: todayLabel(),
        time: currentTimeLabel(),
        timestamp: Date.now(),
        status: 'Completed',
        rating: null
      });
    } catch (err) {
      console.warn('Could not record call history:', err);
    }
  }

  if (shouldRate && wasConnected && activeCallCopy) {
    openRatingModal();
  } else {
    // If not rating (e.g. cancelled/declined/empty), reset active state now
    appState.activeCall = null;
    currentCallId = null;
  }
}


/* ==========================================================================
   SECTION 10: RATING MODAL — log hours + star rating after a call
   ========================================================================== */

let selectedStarRating = 5;

function openRatingModal() {
  if (!appState.activeCall) return;

  const otherPerson = appState.people[appState.activeCall.otherPersonId] || {};
  const partnerName = otherPerson.name || 'your partner';

  document.getElementById('ratingWith').textContent = `Rate your swap with ${partnerName}`;

  selectedStarRating = 5;
  highlightStars(5);

  const hoursGuess = Math.max(0.5, Math.round((callSecondsElapsed / 3600) * 2) / 2) || 1;
  document.getElementById('hoursInput').value = hoursGuess;

  document.getElementById('ratingModal').classList.remove('hidden');
}

function highlightStars(count) {
  document.querySelectorAll('#starPicker span').forEach(star => {
    star.classList.toggle('active', Number(star.dataset.val) <= count);
  });
}

function setupStarPicker() {
  document.querySelectorAll('#starPicker span').forEach(star => {
    star.addEventListener('click', () => {
      selectedStarRating = Number(star.dataset.val);
      highlightStars(selectedStarRating);
    });
    star.addEventListener('mouseenter', () => highlightStars(Number(star.dataset.val)));
  });
  document.getElementById('starPicker').addEventListener('mouseleave', () => highlightStars(selectedStarRating));
}

function setupRatingSubmit() {
  // 1. Submit rating button
  document.getElementById('submitRatingBtn').addEventListener('click', async () => {
    const btn = document.getElementById('submitRatingBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const activeCall = appState.activeCall;
    const myUid = appState.currentUser ? appState.currentUser.uid : null;

    try {
      if (!activeCall || !myUid) return;

      const hours = parseFloat(document.getElementById('hoursInput').value) || 1;
      const otherPersonId = activeCall.otherPersonId;
      const otherPerson = appState.people[otherPersonId] || {};
      const me = appState.people[myUid] || {};

      const partnerName = otherPerson.name || 'Partner';
      const myName = me.name || 'Member';
      const skillName = otherPerson.teach?.[0]?.name || me.learn?.[0]?.name || 'a skill';

      // 1. Update call history entry with star rating and hours
      if (appState.lastCallKey) {
        try {
          await update(ref(db, `people/${myUid}/callHistory/${appState.lastCallKey}`), {
            rating: selectedStarRating,
            hours: hours
          });
        } catch (e) {}
      }

      // Also save to legacy history for complete backward compatibility
      try {
        const myHistoryRef = push(ref(db, `people/${myUid}/history`));
        await set(myHistoryRef, {
          withWhom: partnerName,
          skill: skillName,
          hours,
          rating: selectedStarRating,
          date: todayLabel(),
          timestamp: Date.now()
        });
      } catch (err) {
        console.warn('Could not save to history:', err);
      }

      // 2. Attempt to update partner's rating and teaching hours
      try {
        const oldTotal = (otherPerson.rating || 0) * (otherPerson.ratingCount || 0);
        const newRatingCount = (otherPerson.ratingCount || 0) + 1;
        const newRating = (oldTotal + selectedStarRating) / newRatingCount;
        const newHoursTaught = (otherPerson.hoursTaught || 0) + hours;
        const newSkillsTaught = (otherPerson.skillsTaughtCount || 0) + 1;
        const mySkillsLearned = (me.skillsLearnedCount || 0) + 1;

        await update(ref(db, 'people/' + myUid), {
          skillsLearnedCount: mySkillsLearned
        });

        await update(ref(db, 'people/' + otherPersonId), {
          rating: newRating,
          ratingCount: newRatingCount,
          hoursTaught: newHoursTaught,
          skillsTaughtCount: newSkillsTaught
        });
      } catch (err) {
        console.warn('Could not update other person stats:', err);
      }

      // 3. Clean up call signaling data
      if (currentCallId) {
        try { await remove(ref(db, 'calls/' + currentCallId)); } catch (e) {}
      }
      try {
        await remove(ref(db, `incomingCalls/${myUid}`));
        if (otherPersonId) await remove(ref(db, `incomingCalls/${otherPersonId}`));
      } catch (e) {}

      showToast(`⭐ Thanks! You rated ${partnerName} ${selectedStarRating} stars.`);
    } catch (err) {
      console.error('Error submitting rating:', err);
      showToast('Rating recorded.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit & finish';

      // Always close rating modal
      document.getElementById('ratingModal').classList.add('hidden');

      // Clear active call state
      appState.activeCall = null;
      currentCallId = null;

      // REDIRECT TO DASHBOARD
      goToPage('dashboard');
    }
  });

  // 2. Skip rating button
  const skipBtn = document.getElementById('skipRatingBtn');
  if (skipBtn) {
    skipBtn.addEventListener('click', async () => {
      document.getElementById('ratingModal').classList.add('hidden');

      // Clean up call signaling
      if (currentCallId) {
        try { await remove(ref(db, 'calls/' + currentCallId)); } catch (e) {}
      }
      if (appState.currentUser) {
        try { await remove(ref(db, `incomingCalls/${appState.currentUser.uid}`)); } catch (e) {}
      }

      appState.activeCall = null;
      currentCallId = null;

      goToPage('dashboard');
    });
  }
}

function todayLabel() {
  const options = { month: 'short', day: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
}

function currentTimeLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCallDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 60) {
    return `${totalSeconds || 0}s`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
}


/* ==========================================================================
   SECTION 11: DASHBOARD PAGE — profile summary, stats, skill lists, call history
   ========================================================================== */

function renderDashboard() {
  if (!appState.currentUser) {
    document.getElementById('dashName').textContent = 'Not logged in';
    document.getElementById('dashBio').textContent = 'Log in to see your dashboard.';
    document.getElementById('dashAvatar').textContent = '🔒';
    ['dashTeachCount','dashLearnCount','dashHours'].forEach(id => document.getElementById(id).textContent = '0');
    document.getElementById('dashRatingCard').textContent = '0.0';
    document.getElementById('dashTeachList').innerHTML = '';
    document.getElementById('dashLearnList').innerHTML = '';
    document.getElementById('historyList').innerHTML = `<div class="empty-state"><span>✍️</span>No sessions yet.</div>`;
    return;
  }

  const myUid = appState.currentUser.uid;
  const me = appState.people[myUid];
  if (!me) return; // profile data may still be loading from the database

  const displayName = me.name || appState.currentUser.displayName || (appState.currentUser.email ? appState.currentUser.email.split('@')[0] : 'Member');
  document.getElementById('dashAvatar').textContent = me.avatar || '🙂';
  document.getElementById('dashName').textContent = displayName;
  document.getElementById('dashBio').textContent = me.bio || 'No bio yet.';
  document.getElementById('dashStars').textContent = starString(me.rating || 0);
  document.getElementById('dashRatingNum').textContent = `(${(me.rating || 0).toFixed(1)})`;

  // Skills Taught and Skills Learned count how many swap mentoring sessions the user has completed.
  // For a brand new account, both start cleanly at 0.
  let skillsTaughtCount = 0;
  let skillsLearnedCount = 0;

  if (typeof me.skillsTaughtCount === 'number') {
    skillsTaughtCount = me.skillsTaughtCount;
  } else if (me.callHistory || me.history) {
    const sessions = Object.values(me.callHistory || me.history || {});
    skillsTaughtCount = sessions.filter(s => s.status === 'Completed' || (s.hours && s.hours > 0)).length;
    skillsLearnedCount = sessions.filter(s => s.role === 'learner' || s.learned).length;
  }

  document.getElementById('dashTeachCount').textContent = skillsTaughtCount;
  document.getElementById('dashLearnCount').textContent = skillsLearnedCount;
  document.getElementById('dashHours').textContent = Math.round(me.hoursTaught || 0);
  document.getElementById('dashRatingCard').textContent = (me.rating || 0).toFixed(1);

  // Email Authentication & Verification Status Indicator
  const emailBadge = document.getElementById('dashEmailBadge');
  const resendBtn = document.getElementById('btnResendVerification');
  const checkBtn = document.getElementById('btnCheckVerification');

  if (emailBadge && appState.currentUser) {
    const isEmailVerified = appState.currentUser.emailVerified === true;
    const userEmail = appState.currentUser.email || me.email || '';
    if (isEmailVerified) {
      emailBadge.className = 'email-status-tag verified';
      emailBadge.innerHTML = `✅ Email Verified (${userEmail})`;
      if (resendBtn) resendBtn.style.display = 'none';
      if (checkBtn) checkBtn.style.display = 'none';
    } else {
      emailBadge.className = 'email-status-tag unverified';
      emailBadge.innerHTML = `⚠️ Email Not Verified (${userEmail})`;
      if (resendBtn) resendBtn.style.display = 'inline-block';
      if (checkBtn) checkBtn.style.display = 'inline-block';
    }
  }

  document.getElementById('dashTeachList').innerHTML = (me.teach || []).map(s =>
    `<div class="dash-skill-item">📚 ${s.name} <span class="muted">teaching</span></div>`
  ).join('') || `<p class="muted">You haven't added a skill to teach yet.</p>`;

  document.getElementById('dashLearnList').innerHTML = (me.learn || []).map(s =>
    `<div class="dash-skill-item">🎯 ${s.name} <span class="muted">learning</span></div>`
  ).join('') || `<p class="muted">You haven't added a skill to learn yet.</p>`;

  // Video Call & Session History
  const historyList = document.getElementById('historyList');
  const countEl = document.getElementById('callHistoryCount');

  let callEntries = [];
  if (me.callHistory) {
    callEntries = Object.entries(me.callHistory).map(([key, item]) => ({ key, ...item }));
  } else if (me.history) {
    callEntries = Object.entries(me.history).map(([key, item]) => ({
      key,
      ...item,
      durationText: `${item.hours || 1}h`,
      status: 'Completed'
    }));
  }

  if (countEl) countEl.textContent = `${callEntries.length} ${callEntries.length === 1 ? 'session' : 'sessions'}`;

  if (callEntries.length === 0) {
    historyList.innerHTML = `<div class="empty-state"><span>📹</span>No video call sessions logged yet — hop on a call to see your history here!</div>`;
  } else {
    callEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    historyList.innerHTML = callEntries.map(call => `
      <div class="call-history-item">
        <div class="call-history-left">
          <div class="call-history-avatar">${call.partnerAvatar || '📹'}</div>
          <div class="call-history-details">
            <div class="call-history-title">Video session with ${call.withWhom || 'Partner'}</div>
            <div class="call-history-subtitle">Skill: <b>${call.skill || 'Swap'}</b> · ${call.date || todayLabel()}${call.time ? ` at ${call.time}` : ''}</div>
          </div>
        </div>
        <div class="call-history-right">
          <span class="call-duration-badge">⏱️ ${call.durationText || (call.hours ? `${call.hours}h` : 'Session')}</span>
          ${call.rating ? `<span class="stars">${starString(call.rating)}</span>` : '<span class="status-pill status-accepted">Completed</span>'}
        </div>
      </div>
    `).join('');
  }
}

// EDIT PROFILE MODAL (fixes the bug where clicking edit redirected to signup)
function setupDashboardEditProfile() {
  const editBtn = document.getElementById('dashEditProfileBtn');
  const modal = document.getElementById('editProfileModal');
  const closeBtn = document.getElementById('closeEditModalBtn');
  const cancelBtn = document.getElementById('cancelEditModalBtn');
  const form = document.getElementById('editProfileForm');
  const picker = document.getElementById('editAvatarPicker');

  if (!editBtn || !modal) return;

  // Render emoji picker inside edit modal
  picker.innerHTML = AVATAR_OPTIONS.map(emoji =>
    `<div class="avatar-option" data-emoji="${emoji}">${emoji}</div>`
  ).join('');

  picker.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      picker.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      document.getElementById('editAvatar').value = opt.dataset.emoji;
    });
  });

  const openModal = () => {
    if (!appState.currentUser) {
      showToast('⚠️ Please log in first!');
      goToPage('login');
      return;
    }
    const myUid = appState.currentUser.uid;
    const me = appState.people[myUid] || {};

    document.getElementById('editName').value = me.name || '';
    document.getElementById('editBio').value = (me.bio && me.bio !== 'No bio yet.') ? me.bio : '';
    document.getElementById('editTeach').value = me.teach?.[0]?.name || '';
    document.getElementById('editLearn').value = me.learn?.[0]?.name || '';
    document.getElementById('editAvatar').value = me.avatar || '🙂';

    picker.querySelectorAll('.avatar-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.emoji === (me.avatar || '🙂'));
    });

    const note = document.getElementById('editProfileNote');
    if (note) {
      note.textContent = '';
      note.classList.remove('error');
    }

    modal.classList.remove('hidden');
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  editBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!appState.currentUser) return;
    const myUid = appState.currentUser.uid;

    const saveBtn = document.getElementById('saveProfileBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const name = document.getElementById('editName').value.trim();
    const avatar = document.getElementById('editAvatar').value;
    const bio = document.getElementById('editBio').value.trim() || 'No bio yet.';
    const teachSkill = document.getElementById('editTeach').value.trim();
    const learnSkill = document.getElementById('editLearn').value.trim();

    try {
      await update(ref(db, 'people/' + myUid), {
        name,
        avatar,
        bio,
        teach: [{ name: teachSkill, category: 'other' }],
        learn: [{ name: learnSkill, category: 'other' }]
      });

      showToast('🎉 Profile updated successfully!');
      closeModal();
      renderDashboard();
    } catch (err) {
      console.error('Error updating profile:', err);
      const note = document.getElementById('editProfileNote');
      if (note) {
        note.classList.add('error');
        note.textContent = 'Failed to update profile: ' + err.message;
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save changes';
    }
  });
}

function setupEmailVerificationButtons() {
  const btnResend = document.getElementById('btnResendVerification');
  const btnCheck = document.getElementById('btnCheckVerification');

  if (btnResend) {
    btnResend.addEventListener('click', async () => {
      if (!appState.currentUser) return;
      btnResend.disabled = true;
      btnResend.textContent = 'Sending...';
      try {
        await sendEmailVerification(appState.currentUser);
        showToast(`✉️ Verification link sent to ${appState.currentUser.email}! Please check your inbox.`);
      } catch (err) {
        showToast('⚠️ Could not send link: ' + err.message);
      } finally {
        setTimeout(() => {
          btnResend.disabled = false;
          btnResend.textContent = 'Send Verification Link';
        }, 3000);
      }
    });
  }

  if (btnCheck) {
    btnCheck.addEventListener('click', async () => {
      if (!appState.currentUser) return;
      btnCheck.disabled = true;
      btnCheck.textContent = 'Checking...';
      try {
        await appState.currentUser.reload();
        renderDashboard();
        if (appState.currentUser.emailVerified) {
          showToast('🎉 Awesome! Your email is verified.');
        } else {
          showToast('⏳ Email is not verified yet. Please check your inbox for the confirmation link.');
        }
      } catch (err) {
        showToast('Error checking status: ' + err.message);
      } finally {
        btnCheck.disabled = false;
        btnCheck.textContent = 'Check Status';
      }
    });
  }
}


/* ==========================================================================
   SECTION 14: TEXT CHAT ENGINE & DIRECT MESSAGING
   ========================================================================== */

function getChatRoomId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

function setupChatPage() {
  const form = document.getElementById('chatForm');
  const searchInput = document.getElementById('chatSearchInput');
  const backBtn = document.getElementById('chatBackBtn');
  const callBtn = document.getElementById('chatStartCallBtn');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await sendCurrentChatMessage();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderChatSidebar();
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('chatSidebar');
      const main = document.getElementById('chatMain');
      if (sidebar) sidebar.classList.remove('hidden-mobile');
      if (main) main.classList.add('hidden-mobile');
    });
  }

  if (callBtn) {
    callBtn.addEventListener('click', () => {
      if (appState.activeChatPartnerId) {
        startOutgoingCall(null, appState.activeChatPartnerId);
      }
    });
  }
}

function renderChatPage() {
  if (!appState.currentUser) {
    showToast('⚠️ Please log in to chat!');
    goToPage('login');
    return;
  }

  renderChatSidebar();

  // If a partner is already active, reload active chat
  if (appState.activeChatPartnerId) {
    openChatWith(appState.activeChatPartnerId, false);
  } else {
    // Pick the first active swap partner if available
    const myUid = appState.currentUser.uid;
    const activeRequests = Object.values(appState.requests).filter(
      r => r.status === 'accepted' && (r.fromId === myUid || r.toId === myUid)
    );
    if (activeRequests.length > 0) {
      const firstReq = activeRequests[0];
      const partnerId = firstReq.fromId === myUid ? firstReq.toId : firstReq.fromId;
      openChatWith(partnerId, false);
    }
  }
}

function renderChatSidebar() {
  const container = document.getElementById('chatConversationsList');
  if (!container || !appState.currentUser) return;

  const myUid = appState.currentUser.uid;
  const searchFilter = (document.getElementById('chatSearchInput')?.value || '').toLowerCase();

  const partnerUids = new Set();

  // 1. Accepted swap partners
  Object.values(appState.requests).forEach(req => {
    if (req.status === 'accepted') {
      if (req.fromId === myUid && req.toId) partnerUids.add(req.toId);
      if (req.toId === myUid && req.fromId) partnerUids.add(req.fromId);
    }
  });

  // 2. If no accepted swaps, show all community members
  if (partnerUids.size === 0) {
    Object.keys(appState.people).forEach(uid => {
      if (uid !== myUid) partnerUids.add(uid);
    });
  }

  let partners = Array.from(partnerUids)
    .map(uid => ({ uid, ...(appState.people[uid] || {}) }))
    .filter(p => p.name);

  if (searchFilter) {
    partners = partners.filter(p =>
      p.name.toLowerCase().includes(searchFilter) ||
      (p.teach || []).some(s => s.name.toLowerCase().includes(searchFilter))
    );
  }

  if (partners.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:1.5rem 0.5rem; font-size:0.88rem;"><span>💬</span>No contacts found. Send or accept a swap to chat!</div>`;
    return;
  }

  container.innerHTML = partners.map(p => {
    const isSelected = appState.activeChatPartnerId === p.uid;
    const online = isUserOnline(p);
    const subtitle = p.teach?.[0]?.name ? `Teaches ${p.teach[0].name}` : (p.bio || 'SkillSwap member');

    return `
      <div class="chat-conversation-item ${isSelected ? 'active' : ''}" data-uid="${p.uid}">
        <div class="chat-avatar-wrapper">
          <div class="chat-item-avatar">${p.avatar || '🙂'}</div>
          <span class="chat-presence-indicator ${online ? 'online' : 'offline'}"></span>
        </div>
        <div class="chat-item-info">
          <div class="chat-item-name-row">
            <div class="chat-item-name">${p.name}</div>
          </div>
          <div class="chat-item-preview">${subtitle}</div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.chat-conversation-item').forEach(item => {
    item.addEventListener('click', () => {
      openChatWith(item.dataset.uid);
    });
  });
}

function openChatWith(otherUserId, shouldSwitchPage = true) {
  if (!appState.currentUser) {
    showToast('⚠️ Please log in to chat!');
    goToPage('login');
    return;
  }

  appState.activeChatPartnerId = otherUserId;

  if (shouldSwitchPage) {
    goToPage('chat');
  }

  const partner = appState.people[otherUserId] || {};
  const myUid = appState.currentUser.uid;
  const online = isUserOnline(partner);

  // Mobile layout responsiveness
  const sidebar = document.getElementById('chatSidebar');
  const main = document.getElementById('chatMain');
  const backBtn = document.getElementById('chatBackBtn');
  if (window.innerWidth <= 640) {
    if (sidebar) sidebar.classList.add('hidden-mobile');
    if (main) main.classList.remove('hidden-mobile');
    if (backBtn) backBtn.classList.remove('hidden');
  }

  // Switch from empty placeholder to active chat
  document.getElementById('chatNoActive')?.classList.add('hidden');
  document.getElementById('chatActiveWindow')?.classList.remove('hidden');

  // Header info
  document.getElementById('chatPartnerAvatar').textContent = partner.avatar || '🙂';
  document.getElementById('chatPartnerName').textContent = partner.name || 'Swap Partner';

  const presenceEl = document.getElementById('chatPartnerPresence');
  if (presenceEl) {
    presenceEl.className = `online-badge ${online ? 'online' : 'offline'}`;
    presenceEl.innerHTML = `<span class="status-dot ${online ? 'online' : 'offline'}"></span>${online ? 'Online' : 'Offline'}`;
  }

  // Update selection highlight in sidebar
  document.querySelectorAll('.chat-conversation-item').forEach(item => {
    item.classList.toggle('active', item.dataset.uid === otherUserId);
  });

  // Load message stream
  loadChatMessages(myUid, otherUserId);
}

function loadChatMessages(myUid, otherUserId) {
  const container = document.getElementById('chatMessagesContainer');
  if (!container) return;

  container.innerHTML = '<div class="empty-state" style="margin:auto;"><span>⏳</span>Loading messages...</div>';

  const roomId = getChatRoomId(myUid, otherUserId);
  const messagesRef = ref(db, `chats/${roomId}/messages`);

  // Detach previous listener if exists
  if (appState.currentChatListener) {
    appState.currentChatListener();
    appState.currentChatListener = null;
  }

  appState.currentChatListener = onValue(messagesRef, (snapshot) => {
    // Ensure we are still viewing this chat
    if (appState.activeChatPartnerId !== otherUserId) return;

    const messagesData = snapshot.val();
    if (!messagesData) {
      const partner = appState.people[otherUserId] || {};
      container.innerHTML = `
        <div class="chat-empty-state" style="margin:auto; background:white; padding:2rem; border-radius:var(--radius-md);">
          <span>👋</span>
          <p>No messages yet with <b>${partner.name || 'partner'}</b>.<br>Say hello and coordinate your swap!</p>
        </div>
      `;
      return;
    }

    const messagesList = Object.entries(messagesData).map(([id, msg]) => ({ id, ...msg }));
    messagesList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    container.innerHTML = messagesList.map(msg => {
      const isMe = msg.senderId === myUid;
      const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      return `
        <div class="chat-message-row ${isMe ? 'me' : 'them'}">
          <div class="chat-bubble">${escapeHtml(msg.text)}</div>
          <div class="chat-msg-time">${timeStr}</div>
        </div>
      `;
    }).join('');

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  });
}

async function sendCurrentChatMessage() {
  const input = document.getElementById('chatMessageInput');
  const text = input?.value?.trim();
  if (!text || !appState.currentUser || !appState.activeChatPartnerId) return;

  const myUid = appState.currentUser.uid;
  const partnerId = appState.activeChatPartnerId;
  const me = appState.people[myUid] || {};
  const roomId = getChatRoomId(myUid, partnerId);

  input.value = '';

  const messagesRef = ref(db, `chats/${roomId}/messages`);
  const newMsgRef = push(messagesRef);

  await set(newMsgRef, {
    senderId: myUid,
    senderName: me.name || 'Member',
    text: text,
    timestamp: Date.now()
  });

  // Update room metadata for recent conversation view
  await update(ref(db, `chats/${roomId}`), {
    lastMessage: text,
    lastSenderId: myUid,
    updatedAt: Date.now(),
    participants: {
      [myUid]: true,
      [partnerId]: true
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* ==========================================================================
   SECTION 12: TOAST NOTIFICATIONS (unchanged from original)
   ========================================================================== */

let toastTimeout = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3200);
}


/* ==========================================================================
   SECTION 13: APP STARTUP
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  setupAuthListener();

  setupNavigation();
  setupAvatarPicker();
  setupSignupForm();
  setupLoginForm();
  setupLogout();
  setupBrowseFilters();
  setupRequestTabs();
  setupVideoControls();
  setupStarPicker();
  setupRatingSubmit();
  setupDashboardEditProfile();
  setupEmailVerificationButtons();
  setupEmailValidationFeedback();
  setupChatPage();

  renderHomeStats();
});
