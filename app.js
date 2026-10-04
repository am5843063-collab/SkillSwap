/**
 * ==============================================================================
 * SKILLSWAP - MAIN APPLICATION JAVASCRIPT
 * ==============================================================================
 * 
 * Welcome to the SkillSwap JavaScript codebase!
 * This file is written with extensive explanatory comments so beginners can easily 
 * follow how modern web applications manage state, manipulate the DOM, communicate 
 * with browser APIs (like camera/mic via WebRTC), and store data with localStorage.
 * 
 * TABLE OF CONTENTS:
 * 1. Initial Community Seed Data
 * 2. State Management & LocalStorage
 * 3. User Switcher & Profile Initialization
 * 4. Single Page Application (SPA) Tab Navigation
 * 5. Skill Discovery & Search/Filter System
 * 6. Swap Request Modal & Request Flow
 * 7. Live Video Calling Engine (WebRTC + Simulator)
 * 8. Session Review, Star Rating & Hours Calculation
 * 9. Profile Dashboard & Interactive Skill Management
 * 10. Registration & New Account Creation
 * 11. Toast Notification System
 * ==============================================================================
 */

// Global App State Object
const AppState = {
  users: [],             // All registered users & community mentors
  requests: [],          // Swap proposals (pending, accepted, declined)
  activeUserId: null,    // ID of the currently logged-in / active user
  activeVideoCall: null, // Information about the currently ongoing video call
  mediaStream: null,     // Real local webcam/mic media stream
  callTimerInterval: null,
  callSecondsElapsed: 0,
  isMicMuted: false,
  isCamOff: false,
  isSharingScreen: false,
  selectedRating: 5       // Rating chosen in post-call modal
};

// Key used to persist data in browser's localStorage
const STORAGE_KEY_USERS = 'skillswap_users_v1';
const STORAGE_KEY_REQUESTS = 'skillswap_requests_v1';
const STORAGE_KEY_ACTIVE_USER = 'skillswap_active_user_v1';

/* ==============================================================================
   SECTION 1: INITIAL SEED DATA
   Realistic community users to explore, trade skills with, and video call.
   ============================================================================== */
const INITIAL_USERS = [
  {
    id: 'user_1',
    name: 'Elena Rostova',
    headline: 'Senior Product Designer & UI/UX Mentor',
    bio: 'Over 6 years of experience building design systems and intuitive SaaS interfaces. Passionate about exchanging design tips for frontend coding.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    tier: 'Verified Mentor',
    hoursTaught: 34.5,
    ratingAvg: 4.9,
    reviewsCount: 28,
    teachSkills: [
      { id: 's1', name: 'UI/UX Design', category: 'Design', proficiency: 'Expert' },
      { id: 's2', name: 'Figma Prototyping', category: 'Design', proficiency: 'Expert' },
      { id: 's3', name: 'Design Systems', category: 'Design', proficiency: 'Advanced' }
    ],
    learnSkills: [
      { id: 'l1', name: 'React.js', category: 'Coding' },
      { id: 'l2', name: 'Python for AI', category: 'Coding' },
      { id: 'l3', name: 'Blender 3D', category: 'Design' }
    ],
    reviews: [
      { id: 'r1', reviewerName: 'Alex Rivers', rating: 5, comment: 'Elena transformed my approach to user research and Figma auto-layout. Super patient and clear!', date: '2 days ago' },
      { id: 'r2', reviewerName: 'Marcus Vance', rating: 5, comment: 'Fantastic session! She gave actionable advice on portfolio design in exchange for Spanish tips.', date: '1 week ago' },
      { id: 'r3', reviewerName: 'Priya Sharma', rating: 4.8, comment: 'Great eye for detail. The live video call made design walkthroughs so seamless.', date: '2 weeks ago' }
    ]
  },
  {
    id: 'user_2',
    name: 'Alex Rivers',
    headline: 'Full-Stack Web & TypeScript Specialist',
    bio: 'JavaScript/TypeScript nerd who loves building snappy SPAs and modern web apps. Looking to sharpen my visual design and user flow skills.',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80',
    tier: 'Master Mentor',
    hoursTaught: 27.0,
    ratingAvg: 4.8,
    reviewsCount: 19,
    teachSkills: [
      { id: 's4', name: 'React.js', category: 'Coding', proficiency: 'Expert' },
      { id: 's5', name: 'TypeScript', category: 'Coding', proficiency: 'Advanced' },
      { id: 's6', name: 'Node.js & APIs', category: 'Coding', proficiency: 'Advanced' }
    ],
    learnSkills: [
      { id: 'l4', name: 'UI/UX Design', category: 'Design' },
      { id: 'l5', name: 'Figma Prototyping', category: 'Design' },
      { id: 'l6', name: 'Spanish Conversation', category: 'Languages' }
    ],
    reviews: [
      { id: 'r4', reviewerName: 'Elena Rostova', rating: 5, comment: 'Alex explained React hooks and state management with crystal clarity. Awesome mentor!', date: '3 days ago' },
      { id: 'r5', reviewerName: 'Liam O’Connor', rating: 4.7, comment: 'Helped me debug my audio app’s API routes during our call. Highly recommended!', date: '3 weeks ago' }
    ]
  },
  {
    id: 'user_3',
    name: 'Marcus Vance',
    headline: 'Polyglot Coach & Global Communicator',
    bio: 'Fluent in 4 languages. I host engaging cultural & language exchange sessions and want to dive deeper into Web Development and Audio Production.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    tier: 'Top Rated Tutor',
    hoursTaught: 58.0,
    ratingAvg: 5.0,
    reviewsCount: 42,
    teachSkills: [
      { id: 's7', name: 'Spanish Conversation', category: 'Languages', proficiency: 'Expert' },
      { id: 's8', name: 'Japanese for Beginners', category: 'Languages', proficiency: 'Intermediate' },
      { id: 's9', name: 'Public Speaking', category: 'Marketing', proficiency: 'Advanced' }
    ],
    learnSkills: [
      { id: 'l7', name: 'React.js', category: 'Coding' },
      { id: 'l8', name: 'Music Production', category: 'Music' }
    ],
    reviews: [
      { id: 'r6', reviewerName: 'Elena Rostova', rating: 5, comment: 'Marcus made conversational Spanish so fun! We practiced real dialogue scenarios.', date: 'Just now' },
      { id: 'r7', reviewerName: 'Priya Sharma', rating: 5, comment: 'Unbelievable tips for confident technical presentations.', date: '1 month ago' }
    ]
  },
  {
    id: 'user_4',
    name: 'Priya Sharma',
    headline: 'Mobile Developer & Flutter Enthusiast',
    bio: 'Crafting responsive cross-platform mobile experiences with Flutter & Firebase. Excited to learn conversational Japanese and music production.',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
    tier: 'Rising Star',
    hoursTaught: 19.5,
    ratingAvg: 4.9,
    reviewsCount: 16,
    teachSkills: [
      { id: 's10', name: 'Flutter & Dart', category: 'Coding', proficiency: 'Expert' },
      { id: 's11', name: 'Firebase Backend', category: 'Coding', proficiency: 'Advanced' },
      { id: 's12', name: 'Python Automation', category: 'Coding', proficiency: 'Advanced' }
    ],
    learnSkills: [
      { id: 'l9', name: 'Japanese for Beginners', category: 'Languages' },
      { id: 'l10', name: 'Guitar & Bass', category: 'Music' }
    ],
    reviews: [
      { id: 'r8', reviewerName: 'Alex Rivers', rating: 4.9, comment: 'Priya walked me through state management in Flutter step-by-step. Super valuable!', date: '5 days ago' }
    ]
  },
  {
    id: 'user_5',
    name: 'Liam O’Connor',
    headline: 'Sound Engineer & Acoustic Guitarist',
    bio: 'Producing indie records for 8+ years. Offering audio mixing, guitar lessons, and beatmaking in exchange for mobile and web development mentoring.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
    tier: 'Audio Virtuoso',
    hoursTaught: 16.0,
    ratingAvg: 4.7,
    reviewsCount: 12,
    teachSkills: [
      { id: 's13', name: 'Music Production', category: 'Music', proficiency: 'Expert' },
      { id: 's14', name: 'Guitar & Bass', category: 'Music', proficiency: 'Advanced' }
    ],
    learnSkills: [
      { id: 'l11', name: 'Flutter & Dart', category: 'Coding' },
      { id: 'l12', name: 'UI/UX Design', category: 'Design' }
    ],
    reviews: [
      { id: 'r9', reviewerName: 'Marcus Vance', rating: 5, comment: 'Liam taught me how to lay down my first acoustic rhythm tracks cleanly.', date: '1 week ago' }
    ]
  }
];

// Initial pre-loaded swap proposals for immediate testing
const INITIAL_REQUESTS = [
  {
    id: 'req_1',
    fromUserId: 'user_2', // Alex Rivers
    toUserId: 'user_1',   // Elena Rostova
    requestedSkill: 'UI/UX Design',
    offeredSkill: 'React.js',
    message: 'Hey Elena! I saw your amazing UI portfolio. I would love to trade 1-on-1 React mentoring for some hands-on UX wireframe feedback!',
    status: 'pending',    // 'pending', 'accepted', 'declined'
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'req_2',
    fromUserId: 'user_3', // Marcus Vance
    toUserId: 'user_1',   // Elena Rostova
    requestedSkill: 'Figma Prototyping',
    offeredSkill: 'Spanish Conversation',
    message: 'Hola Elena! Let us practice Spanish speaking while we explore Figma design component variants together.',
    status: 'accepted',   // Already accepted -> ready for Video Call!
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'req_3',
    fromUserId: 'user_1', // Elena Rostova
    toUserId: 'user_4',   // Priya Sharma
    requestedSkill: 'Flutter & Dart',
    offeredSkill: 'UI/UX Design',
    message: 'Hi Priya! I am designing a mobile concept and would love to understand Flutter widgets better. Let me know if you are open to swapping!',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  }
];

/* ==============================================================================
   SECTION 2: STATE MANAGEMENT & LOCALSTORAGE
   ============================================================================== */

/**
 * Loads data from localStorage or initializes with default seed data
 */
function initializeData() {
  const savedUsers = localStorage.getItem(STORAGE_KEY_USERS);
  const savedRequests = localStorage.getItem(STORAGE_KEY_REQUESTS);
  const savedActiveUser = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);

  if (savedUsers) {
    try {
      AppState.users = JSON.parse(savedUsers);
    } catch (e) {
      console.error('Error parsing stored users, resetting to defaults', e);
      AppState.users = INITIAL_USERS;
    }
  } else {
    AppState.users = INITIAL_USERS;
    saveUsers();
  }

  if (savedRequests) {
    try {
      AppState.requests = JSON.parse(savedRequests);
    } catch (e) {
      console.error('Error parsing stored requests, resetting to defaults', e);
      AppState.requests = INITIAL_REQUESTS;
    }
  } else {
    AppState.requests = INITIAL_REQUESTS;
    saveRequests();
  }

  // Active user default is Elena Rostova (user_1)
  if (savedActiveUser && AppState.users.some(u => u.id === savedActiveUser)) {
    AppState.activeUserId = savedActiveUser;
  } else {
    AppState.activeUserId = AppState.users[0].id;
    saveActiveUser();
  }
}

function saveUsers() {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(AppState.users));
}

function saveRequests() {
  localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(AppState.requests));
}

function saveActiveUser() {
  localStorage.setItem(STORAGE_KEY_ACTIVE_USER, AppState.activeUserId);
}

/**
 * Helper to get the full object of the currently logged-in user
 */
function getCurrentUser() {
  return AppState.users.find(u => u.id === AppState.activeUserId) || AppState.users[0];
}

/**
 * Helper to lookup a user by their unique ID
 */
function getUserById(id) {
  return AppState.users.find(u => u.id === id);
}

/* ==============================================================================
   SECTION 3: USER SWITCHER & NAVBAR SETUP
   Allows testing swap requests between different people in the same browser.
   ============================================================================== */

function setupUserSwitcher() {
  const currentUserBtn = document.getElementById('currentUserBtn');
  const userDropdown = document.getElementById('userDropdown');
  const userDropdownList = document.getElementById('userDropdownList');

  // Toggle user switcher dropdown
  currentUserBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('show');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!userDropdown.contains(e.target) && !currentUserBtn.contains(e.target)) {
      userDropdown.classList.remove('show');
    }
  });

  // Render the list of users inside dropdown
  renderUserDropdown();
}

function renderUserDropdown() {
  const userDropdownList = document.getElementById('userDropdownList');
  const currentUser = getCurrentUser();

  userDropdownList.innerHTML = AppState.users.map(user => {
    const isActive = user.id === currentUser.id;
    return `
      <button class="user-select-item ${isActive ? 'active' : ''}" onclick="switchActiveUser('${user.id}')">
        <img src="${user.avatar}" alt="${user.name}" />
        <div class="user-select-info">
          <div class="user-select-name">${user.name} ${isActive ? '✓ (You)' : ''}</div>
          <div class="user-select-role">${user.headline.split('&')[0]}</div>
        </div>
      </button>
    `;
  }).join('');
}

/**
 * Switches the active user, re-rendering all views immediately
 */
window.switchActiveUser = function(userId) {
  AppState.activeUserId = userId;
  saveActiveUser();
  
  // Close dropdown
  document.getElementById('userDropdown').classList.remove('show');
  
  // Refresh navbar and all tabs
  updateNavbarUserInfo();
  renderUserDropdown();
  renderExploreGrid();
  renderRequestsTab();
  renderDashboardTab();
  
  const currentUser = getCurrentUser();
  showToast(`Switched active profile to ${currentUser.name}!`, 'info');
};

function updateNavbarUserInfo() {
  const user = getCurrentUser();
  document.getElementById('navUserAvatar').src = user.avatar;
  document.getElementById('navUserName').textContent = user.name;
  document.getElementById('navUserRole').textContent = user.headline.split('&')[0];

  // Update notification badge on "My Requests" nav item
  updateRequestsBadge();
}

function updateRequestsBadge() {
  const currentUserId = AppState.activeUserId;
  // Count incoming pending requests
  const pendingCount = AppState.requests.filter(
    req => req.toUserId === currentUserId && req.status === 'pending'
  ).length;

  const badge = document.getElementById('requestsCountBadge');
  if (pendingCount > 0) {
    badge.textContent = pendingCount;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ==============================================================================
   SECTION 4: SPA TAB NAVIGATION
   Smooth tab switching without page reload.
   ============================================================================== */

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const brandLogo = document.getElementById('brandLogo');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  brandLogo.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('explore');
  });

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });
  }
}

function switchTab(tabId) {
  // Update nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Show active tab pane
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const targetPane = document.getElementById(`${tabId}Tab`);
  if (targetPane) {
    targetPane.classList.add('active');
  }

  // Close mobile menu if open
  document.getElementById('navLinks').classList.remove('mobile-open');

  // Trigger re-render of tab content
  if (tabId === 'explore') renderExploreGrid();
  if (tabId === 'requests') renderRequestsTab();
  if (tabId === 'dashboard') renderDashboardTab();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==============================================================================
   SECTION 5: SKILL DISCOVERY & SEARCH/FILTER SYSTEM
   Filter mentors by keyword, category, or matching wishlist.
   ============================================================================== */

let currentCategoryFilter = 'all';
let currentSearchQuery = '';
let matchWishlistOnly = false;

function setupExploreFilters() {
  const searchInput = document.getElementById('skillSearchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const categoryPills = document.querySelectorAll('.pill-btn');
  const matchWishlistToggle = document.getElementById('matchWishlistToggle');

  // Live search input with input event
  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    searchClearBtn.style.display = currentSearchQuery.length > 0 ? 'block' : 'none';
    renderExploreGrid();
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    searchClearBtn.style.display = 'none';
    renderExploreGrid();
  });

  // Category filter pills
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategoryFilter = pill.getAttribute('data-category');
      renderExploreGrid();
    });
  });

  // Wishlist match toggle
  matchWishlistToggle.addEventListener('change', (e) => {
    matchWishlistOnly = e.target.checked;
    renderExploreGrid();
  });
}

function renderExploreGrid() {
  const mentorsGrid = document.getElementById('mentorsGrid');
  const resultsCount = document.getElementById('resultsCount');
  const currentUser = getCurrentUser();

  // Wishlist of skills current user wants to learn
  const myWishlistSkills = currentUser.learnSkills.map(s => s.name.toLowerCase());

  // Filter users: Exclude active user from marketplace
  const filteredUsers = AppState.users.filter(user => {
    if (user.id === currentUser.id) return false;

    // Search query filter
    if (currentSearchQuery) {
      const matchName = user.name.toLowerCase().includes(currentSearchQuery);
      const matchBio = user.bio.toLowerCase().includes(currentSearchQuery);
      const matchTeach = user.teachSkills.some(s => s.name.toLowerCase().includes(currentSearchQuery));
      const matchLearn = user.learnSkills.some(s => s.name.toLowerCase().includes(currentSearchQuery));
      if (!matchName && !matchBio && !matchTeach && !matchLearn) return false;
    }

    // Category filter
    if (currentCategoryFilter !== 'all') {
      const hasCategory = user.teachSkills.some(s => s.category.toLowerCase() === currentCategoryFilter.toLowerCase());
      if (!hasCategory) return false;
    }

    // Wishlist match filter: Mentor must teach at least one skill in active user's learnSkills
    if (matchWishlistOnly) {
      const matchesMyWishlist = user.teachSkills.some(s => 
        myWishlistSkills.some(wish => s.name.toLowerCase().includes(wish) || wish.includes(s.name.toLowerCase()))
      );
      if (!matchesMyWishlist) return false;
    }

    return true;
  });

  // Update counter label
  resultsCount.textContent = `Showing ${filteredUsers.length} mentor${filteredUsers.length === 1 ? '' : 's'}`;

  // Render cards or empty state
  if (filteredUsers.length === 0) {
    mentorsGrid.innerHTML = `
      <div class="empty-state-box" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <h3>No mentors matched your filter</h3>
        <p>Try clearing your search query or switching categories to discover more peers.</p>
      </div>
    `;
    return;
  }

  mentorsGrid.innerHTML = filteredUsers.map(user => {
    // Generate Stars visual (e.g. ★★★★★)
    const fullStars = Math.floor(user.ratingAvg);
    const starString = '★'.repeat(fullStars) + (user.ratingAvg % 1 >= 0.5 ? '½' : '');

    return `
      <div class="mentor-card">
        <div>
          <!-- Header with Avatar and Rating -->
          <div class="mentor-card-header">
            <div class="mentor-avatar-box">
              <img src="${user.avatar}" alt="${user.name}" class="mentor-avatar" />
              <span class="online-status-dot" title="Online for swaps"></span>
            </div>
            <div class="mentor-title-box">
              <h3 class="mentor-name">${user.name}</h3>
              <p class="mentor-headline">${user.headline}</p>
              <div class="mentor-rating-row">
                <span>${user.ratingAvg.toFixed(1)} ${starString}</span>
                <span class="reviews-tally">(${user.reviewsCount} reviews)</span>
              </div>
            </div>
          </div>

          <!-- Short Bio -->
          <p class="mentor-bio-text">${user.bio}</p>

          <!-- Skills Taught -->
          <div class="card-skills-section">
            <div class="skills-section-label teach-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Can Teach You:</span>
            </div>
            <div class="tag-cloud">
              ${user.teachSkills.map(skill => `
                <span class="skill-tag skill-tag-teach">
                  ${skill.name}
                  <span class="skill-proficiency-badge">${skill.proficiency}</span>
                </span>
              `).join('')}
            </div>
          </div>

          <!-- Skills Desired -->
          <div class="card-skills-section">
            <div class="skills-section-label learn-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <span>Wants to Learn:</span>
            </div>
            <div class="tag-cloud">
              ${user.learnSkills.map(skill => `
                <span class="skill-tag skill-tag-learn">${skill.name}</span>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="mentor-card-footer">
          <div class="hours-teached-pill" title="Total hours teached">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span><strong>${user.hoursTaught} hrs</strong> teached</span>
          </div>

          <button class="btn btn-primary btn-sm" onclick="openSwapRequestModal('${user.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m16 3 4 4-4 4"></path>
              <path d="M20 7H4"></path>
              <path d="m8 21-4-4 4-4"></path>
              <path d="M4 17h16"></path>
            </svg>
            Request Swap
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/* ==============================================================================
   SECTION 6: SWAP REQUEST MODAL & REQUEST FLOW
   ============================================================================== */

function setupSwapRequestModal() {
  const modal = document.getElementById('swapRequestModal');
  const btnClose = document.getElementById('btnCloseSwapModal');
  const btnCancel = document.getElementById('btnCancelSwapModal');
  const form = document.getElementById('swapRequestForm');

  btnClose.addEventListener('click', () => closeSwapModal());
  btnCancel.addEventListener('click', () => closeSwapModal());

  // Close when clicking background overlay
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSwapModal();
  });

  // Handle Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const targetUserId = document.getElementById('targetUserId').value;
    const requestedSkill = document.getElementById('requestedSkillSelect').value;
    const offeredSkill = document.getElementById('offeredSkillSelect').value;
    const message = document.getElementById('swapMessageInput').value.trim();

    if (!requestedSkill || !offeredSkill) {
      showToast('Please select both a skill to learn and a skill to offer!', 'info');
      return;
    }

    // Create new swap proposal object
    const newRequest = {
      id: 'req_' + Date.now(),
      fromUserId: AppState.activeUserId,
      toUserId: targetUserId,
      requestedSkill,
      offeredSkill,
      message: message || `Hi! I would love to learn ${requestedSkill} from you and teach ${offeredSkill} in exchange!`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    AppState.requests.unshift(newRequest);
    saveRequests();
    closeSwapModal();

    const targetUser = getUserById(targetUserId);
    showToast(`Swap request sent to ${targetUser.name}!`, 'success');

    updateRequestsBadge();
  });
}

/**
 * Opens the proposal dialog populated with the recipient's skills
 */
window.openSwapRequestModal = function(targetUserId) {
  const targetUser = getUserById(targetUserId);
  const currentUser = getCurrentUser();

  if (!targetUser) return;

  document.getElementById('targetUserId').value = targetUser.id;
  document.getElementById('targetPartnerAvatar').src = targetUser.avatar;
  document.getElementById('targetPartnerName').textContent = targetUser.name;
  document.getElementById('targetPartnerRole').textContent = targetUser.headline;

  // Populate skills of target user (skills YOU want to learn)
  const requestedSkillSelect = document.getElementById('requestedSkillSelect');
  requestedSkillSelect.innerHTML = '<option value="" disabled selected>Choose a skill...</option>' + 
    targetUser.teachSkills.map(s => `<option value="${s.name}">${s.name} (${s.proficiency})</option>`).join('');

  // Populate skills of active user (skills YOU can teach)
  const offeredSkillSelect = document.getElementById('offeredSkillSelect');
  offeredSkillSelect.innerHTML = '<option value="" disabled selected>Choose from your taught skills...</option>' + 
    currentUser.teachSkills.map(s => `<option value="${s.name}">${s.name} (${s.proficiency})</option>`).join('');

  document.getElementById('swapMessageInput').value = '';

  // Show modal
  const modal = document.getElementById('swapRequestModal');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
};

function closeSwapModal() {
  const modal = document.getElementById('swapRequestModal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

/* ==============================================================================
   SECTION 6B: REQUESTS INBOX MANAGEMENT VIEW
   ============================================================================== */

function setupRequestsView() {
  const subTabBtns = document.querySelectorAll('.sub-tab-btn');
  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      subTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const subtab = btn.getAttribute('data-subtab');
      document.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));
      
      if (subtab === 'received') document.getElementById('subtabReceived').classList.add('active');
      if (subtab === 'accepted') document.getElementById('subtabAccepted').classList.add('active');
      if (subtab === 'sent') document.getElementById('subtabSent').classList.add('active');
    });
  });
}

function renderRequestsTab() {
  const currentUserId = AppState.activeUserId;

  // 1. Received requests
  const receivedList = document.getElementById('receivedRequestsList');
  const incomingPending = AppState.requests.filter(
    req => req.toUserId === currentUserId && req.status === 'pending'
  );
  document.getElementById('receivedCountBadge').textContent = incomingPending.length;

  if (incomingPending.length === 0) {
    receivedList.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-state-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h4>No incoming requests right now</h4>
        <p>When other swappers request to learn from you, their proposals will appear here. Switch users at top right to test sending one!</p>
      </div>
    `;
  } else {
    receivedList.innerHTML = incomingPending.map(req => {
      const sender = getUserById(req.fromUserId) || { name: 'Unknown', avatar: '', headline: '' };
      return `
        <div class="request-card">
          <div class="request-user-info">
            <img src="${sender.avatar}" alt="${sender.name}" class="request-avatar" />
            <div class="request-details">
              <div class="request-name">${sender.name}</div>
              <div class="request-swap-spec">
                Wants to learn <strong>${req.requestedSkill}</strong> from you, offering to teach <strong>${req.offeredSkill}</strong>
              </div>
              <div class="request-note-quote">"${req.message}"</div>
            </div>
          </div>

          <div class="request-actions-row">
            <button class="btn btn-primary btn-sm" onclick="respondToRequest('${req.id}', 'accepted')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Accept Swap
            </button>
            <button class="btn btn-secondary btn-sm" onclick="respondToRequest('${req.id}', 'declined')">
              Decline
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Accepted Swaps (Ready for Video Call!)
  const acceptedList = document.getElementById('acceptedSwapsList');
  const activeSwaps = AppState.requests.filter(
    req => (req.toUserId === currentUserId || req.fromUserId === currentUserId) && req.status === 'accepted'
  );
  document.getElementById('acceptedCountBadge').textContent = activeSwaps.length;

  if (activeSwaps.length === 0) {
    acceptedList.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-state-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
        </div>
        <h4>No active video swap connections yet</h4>
        <p>Accept a pending request or send a swap proposal to start a live 1-on-1 video mentoring session!</p>
      </div>
    `;
  } else {
    acceptedList.innerHTML = activeSwaps.map(req => {
      // Find partner ID
      const partnerId = req.fromUserId === currentUserId ? req.toUserId : req.fromUserId;
      const partner = getUserById(partnerId) || { name: 'Partner', avatar: '', headline: '' };
      
      const youTeach = req.fromUserId === currentUserId ? req.offeredSkill : req.requestedSkill;
      const theyTeach = req.fromUserId === currentUserId ? req.requestedSkill : req.offeredSkill;

      return `
        <div class="request-card" style="border-left: 4px solid var(--emerald);">
          <div class="request-user-info">
            <img src="${partner.avatar}" alt="${partner.name}" class="request-avatar" />
            <div class="request-details">
              <div class="request-name">${partner.name} <span class="badge badge-success" style="font-size:0.68rem; margin-left:0.4rem;">Connected</span></div>
              <div class="request-swap-spec">
                Skill Barter: You learn <strong>${theyTeach}</strong> ⇄ You teach <strong>${youTeach}</strong>
              </div>
              <div style="font-size:0.8rem; color:var(--text-subtle); margin-top:0.25rem;">
                Status: Ready for 1-on-1 live video meeting
              </div>
            </div>
          </div>

          <div class="request-actions-row">
            <button class="btn btn-primary" onclick="launchVideoCall('${partner.id}', '${theyTeach} ⇄ ${youTeach}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
              Start Video Call
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. Sent Proposals
  const sentList = document.getElementById('sentRequestsList');
  const sentRequests = AppState.requests.filter(req => req.fromUserId === currentUserId);
  document.getElementById('sentCountBadge').textContent = sentRequests.length;

  if (sentRequests.length === 0) {
    sentList.innerHTML = `
      <div class="empty-state-box">
        <p>You haven't sent any swap requests yet. Browse the Explore tab to find a mentor!</p>
      </div>
    `;
  } else {
    sentList.innerHTML = sentRequests.map(req => {
      const recipient = getUserById(req.toUserId) || { name: 'User', avatar: '' };
      let statusBadge = `<span class="badge badge-pill badge-muted">Pending</span>`;
      if (req.status === 'accepted') statusBadge = `<span class="badge badge-pill badge-success">Accepted</span>`;
      if (req.status === 'declined') statusBadge = `<span class="badge badge-pill" style="background:var(--rose);">Declined</span>`;

      return `
        <div class="request-card">
          <div class="request-user-info">
            <img src="${recipient.avatar}" alt="${recipient.name}" class="request-avatar" />
            <div class="request-details">
              <div class="request-name">To: ${recipient.name} ${statusBadge}</div>
              <div class="request-swap-spec">
                Proposed to learn <strong>${req.requestedSkill}</strong> for <strong>${req.offeredSkill}</strong>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

/**
 * Handle accept or decline on an incoming proposal
 */
window.respondToRequest = function(requestId, newStatus) {
  const req = AppState.requests.find(r => r.id === requestId);
  if (!req) return;

  req.status = newStatus;
  saveRequests();
  updateRequestsBadge();
  renderRequestsTab();

  const partner = getUserById(req.fromUserId);
  if (newStatus === 'accepted') {
    showToast(`Accepted swap with ${partner.name}! You can now start video calls together.`, 'success');
  } else {
    showToast(`Request from ${partner.name} declined.`, 'info');
  }
};

/* ==============================================================================
   SECTION 7: LIVE VIDEO CALLING ENGINE (WebRTC + Fallback Simulator)
   Features real webcam video with navigator.mediaDevices.getUserMedia,
   mic toggle, camera toggle, screen sharing, live timer, and in-call chat!
   ============================================================================== */

function setupVideoCallSystem() {
  const btnToggleMic = document.getElementById('btnToggleMic');
  const btnToggleCam = document.getElementById('btnToggleCam');
  const btnToggleShare = document.getElementById('btnToggleShare');
  const btnEndCall = document.getElementById('btnEndCall');
  const btnToggleInCallChat = document.getElementById('btnToggleInCallChat');
  const btnCloseChatDrawer = document.getElementById('btnCloseChatDrawer');
  const inCallChatForm = document.getElementById('inCallChatForm');
  const btnFullscreenCall = document.getElementById('btnFullscreenCall');

  // Mic Toggle
  btnToggleMic.addEventListener('click', () => {
    AppState.isMicMuted = !AppState.isMicMuted;
    
    // Toggle actual audio tracks if webcam stream is active
    if (AppState.mediaStream) {
      AppState.mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !AppState.isMicMuted;
      });
    }

    // Toggle icon & visual state
    document.getElementById('iconMicOn').style.display = AppState.isMicMuted ? 'none' : 'block';
    document.getElementById('iconMicOff').style.display = AppState.isMicMuted ? 'block' : 'none';
    btnToggleMic.classList.toggle('active-off', AppState.isMicMuted);
    btnToggleMic.querySelector('.control-text').textContent = AppState.isMicMuted ? 'Unmute' : 'Mute';

    showToast(AppState.isMicMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
  });

  // Camera Toggle
  btnToggleCam.addEventListener('click', () => {
    AppState.isCamOff = !AppState.isCamOff;

    if (AppState.mediaStream) {
      AppState.mediaStream.getVideoTracks().forEach(track => {
        track.enabled = !AppState.isCamOff;
      });
    }

    const localVideo = document.getElementById('localWebcamVideo');
    const placeholder = document.getElementById('localCameraOffPlaceholder');

    if (AppState.isCamOff) {
      localVideo.style.display = 'none';
      placeholder.style.display = 'flex';
    } else {
      localVideo.style.display = 'block';
      placeholder.style.display = 'none';
    }

    document.getElementById('iconCamOn').style.display = AppState.isCamOff ? 'none' : 'block';
    document.getElementById('iconCamOff').style.display = AppState.isCamOff ? 'block' : 'none';
    btnToggleCam.classList.toggle('active-off', AppState.isCamOff);
    btnToggleCam.querySelector('.control-text').textContent = AppState.isCamOff ? 'Start Cam' : 'Camera';
  });

  // Screen Share Toggle
  btnToggleShare.addEventListener('click', async () => {
    AppState.isSharingScreen = !AppState.isSharingScreen;
    const overlay = document.getElementById('screenShareOverlay');
    
    if (AppState.isSharingScreen) {
      overlay.style.display = 'flex';
      btnToggleShare.classList.add('active-off');
      showToast('Screen sharing activated', 'info');

      // Attempt native getDisplayMedia if user supports it
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          displayStream.getVideoTracks()[0].onended = () => {
            overlay.style.display = 'none';
            AppState.isSharingScreen = false;
            btnToggleShare.classList.remove('active-off');
          };
        } catch (err) {
          console.log('Screen share cancelled or unsupported, using simulated overlay', err);
        }
      }
    } else {
      overlay.style.display = 'none';
      btnToggleShare.classList.remove('active-off');
      showToast('Screen sharing stopped', 'info');
    }
  });

  // End Call Button
  btnEndCall.addEventListener('click', () => {
    terminateVideoCall();
  });

  // Toggle in-call notes & chat drawer
  btnToggleInCallChat.addEventListener('click', () => {
    document.getElementById('inCallChatDrawer').classList.toggle('open');
  });

  btnCloseChatDrawer.addEventListener('click', () => {
    document.getElementById('inCallChatDrawer').classList.remove('open');
  });

  // In-call chat messaging
  inCallChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('inCallChatInput');
    const msg = input.value.trim();
    if (!msg) return;

    addInCallChatMessage(msg, 'local');
    input.value = '';

    // Simulate responsive peer reply after 2 seconds
    setTimeout(() => {
      const responses = [
        "Got it! That makes total sense.",
        "Can you share the code repo or doc link for that?",
        "Awesome explanation! Let's try that out together.",
        "Let me write that down in our shared session notes."
      ];
      const randomReply = responses[Math.floor(Math.random() * responses.length)];
      addInCallChatMessage(randomReply, 'remote');
    }, 1800);
  });

  // Fullscreen toggle
  btnFullscreenCall.addEventListener('click', () => {
    const videoModal = document.getElementById('videoCallModal');
    if (!document.fullscreenElement) {
      videoModal.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  });
}

/**
 * Launches the live video calling room with real webcam stream
 */
window.launchVideoCall = async function(partnerId, skillBarterTitle) {
  const partner = getUserById(partnerId);
  const currentUser = getCurrentUser();
  if (!partner) return;

  AppState.activeVideoCall = {
    partnerId: partner.id,
    partnerName: partner.name,
    skillTag: skillBarterTitle || 'Skill Barter'
  };

  // Populate Call Modal UI
  document.getElementById('callPartnerName').textContent = `Session with ${partner.name}`;
  document.getElementById('callSkillTag').textContent = skillBarterTitle || 'Peer Mentoring';
  document.getElementById('callPartnerAvatar').src = partner.avatar;
  document.getElementById('remotePeerLabel').textContent = `${partner.name} (Remote Partner)`;
  document.getElementById('localAvatarInitials').textContent = currentUser.name.slice(0, 2).toUpperCase();

  // Reset controls state
  AppState.isMicMuted = false;
  AppState.isCamOff = false;
  AppState.isSharingScreen = false;
  AppState.callSecondsElapsed = 0;
  document.getElementById('callDurationDisplay').textContent = '00:00';
  document.getElementById('screenShareOverlay').style.display = 'none';
  document.getElementById('localCameraOffPlaceholder').style.display = 'none';
  document.getElementById('localWebcamVideo').style.display = 'block';

  // Open Call Modal
  const videoModal = document.getElementById('videoCallModal');
  videoModal.classList.add('show');
  videoModal.setAttribute('aria-hidden', 'false');

  // Clear in-call messages
  document.getElementById('inCallChatMessages').innerHTML = `
    <div class="chat-msg system">
      <span>Connected with ${partner.name}. Exchange questions and code snippets!</span>
    </div>
  `;

  // Start live session timer
  startCallTimer();

  // Attempt real browser webcam access using WebRTC API
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
      AppState.mediaStream = stream;
      const localVideo = document.getElementById('localWebcamVideo');
      localVideo.srcObject = stream;
      showToast('Camera and microphone connected!', 'success');
    } else {
      throw new Error('getUserMedia not supported in this browser context');
    }
  } catch (err) {
    console.warn('Webcam not available or permission denied; switching to simulated video mode', err);
    document.getElementById('localWebcamVideo').style.display = 'none';
    document.getElementById('localCameraOffPlaceholder').style.display = 'flex';
    document.getElementById('localCameraOffPlaceholder').innerHTML = `
      <div class="avatar-pip-initials">${currentUser.name.slice(0, 2).toUpperCase()}</div>
      <span>Camera Simulator</span>
    `;
    showToast('Camera simulator active (No physical webcam detected or permitted)', 'info');
  }
};

function startCallTimer() {
  if (AppState.callTimerInterval) clearInterval(AppState.callTimerInterval);
  
  AppState.callTimerInterval = setInterval(() => {
    AppState.callSecondsElapsed++;
    const mins = Math.floor(AppState.callSecondsElapsed / 60);
    const secs = AppState.callSecondsElapsed % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('callDurationDisplay').textContent = formatted;
  }, 1000);
}

function addInCallChatMessage(text, sender) {
  const container = document.getElementById('inCallChatMessages');
  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${sender}`;
  msgEl.textContent = text;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

/**
 * Terminates the call, stops tracks, and opens the Review & Star Rating Modal!
 */
function terminateVideoCall() {
  if (AppState.callTimerInterval) {
    clearInterval(AppState.callTimerInterval);
    AppState.callTimerInterval = null;
  }

  // Stop physical camera tracks
  if (AppState.mediaStream) {
    AppState.mediaStream.getTracks().forEach(track => track.stop());
    AppState.mediaStream = null;
  }

  const videoModal = document.getElementById('videoCallModal');
  videoModal.classList.remove('show');
  videoModal.setAttribute('aria-hidden', 'true');

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(err => console.log(err));
  }

  // Calculate session minutes for teaching hours credit
  // For quick demo test purposes, if call was under 1 minute, credit 25 minutes so beginners immediately see hour increments!
  const minutesTaught = AppState.callSecondsElapsed > 60 
    ? Math.round(AppState.callSecondsElapsed / 60) 
    : 25;

  if (AppState.activeVideoCall) {
    openRatingModal(AppState.activeVideoCall.partnerId, minutesTaught);
  }
}

/* ==============================================================================
   SECTION 8: POST-CALL REVIEW, STAR RATING & HOURS CALCULATION
   Logs hours taught to the mentor, updates average star ratings,
   and appends feedback reviews.
   ============================================================================== */

function setupRatingSystem() {
  const starButtons = document.querySelectorAll('.star-btn');
  const ratingFeedbackLabel = document.getElementById('starFeedbackLabel');
  const ratingForm = document.getElementById('ratingForm');

  const ratingPhrases = {
    1: '1 Star: Needs Improvement',
    2: '2 Stars: Fair Session',
    3: '3 Stars: Good Learning Experience',
    4: '4 Stars: Great & Clear Explanations',
    5: '5 Stars: Phenomenal Mentor! Highly Recommended'
  };

  // Interactive hover & selection for stars
  starButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const rating = parseInt(btn.getAttribute('data-rating'));
      highlightStars(rating);
      ratingFeedbackLabel.textContent = ratingPhrases[rating];
    });

    btn.addEventListener('mouseleave', () => {
      highlightStars(AppState.selectedRating);
      ratingFeedbackLabel.textContent = ratingPhrases[AppState.selectedRating];
    });

    btn.addEventListener('click', () => {
      AppState.selectedRating = parseInt(btn.getAttribute('data-rating'));
      highlightStars(AppState.selectedRating);
      ratingFeedbackLabel.textContent = ratingPhrases[AppState.selectedRating];
    });
  });

  // Submit Review Form
  ratingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const partnerId = document.getElementById('ratingTargetUserId').value;
    const sessionMinutes = parseInt(document.getElementById('ratingSessionMinutes').value) || 25;
    const comment = document.getElementById('reviewCommentInput').value.trim();

    const partner = getUserById(partnerId);
    const currentUser = getCurrentUser();

    if (!partner) return;

    // 1. Add review object to partner
    const newReview = {
      id: 'rev_' + Date.now(),
      reviewerName: currentUser.name,
      rating: AppState.selectedRating,
      comment: comment || 'Awesome session! Learned a ton during our live video swap.',
      date: 'Just now'
    };
    partner.reviews.unshift(newReview);
    partner.reviewsCount = partner.reviews.length;

    // 2. Recalculate average star rating
    const totalScore = partner.reviews.reduce((sum, r) => sum + r.rating, 0);
    partner.ratingAvg = parseFloat((totalScore / partner.reviews.length).toFixed(1));

    // 3. Increment partner's hours taught (hours = minutes / 60)
    const hoursAdded = parseFloat((sessionMinutes / 60).toFixed(1));
    partner.hoursTaught = parseFloat((partner.hoursTaught + hoursAdded).toFixed(1));
    partner.completedSkillsTaught = (partner.completedSkillsTaught || 0) + 1;
    currentUser.completedSkillsLearned = (currentUser.completedSkillsLearned || 0) + 1;

    // Save changes to localStorage
    saveUsers();

    // Close rating modal
    closeRatingModal();

    showToast(`Review submitted! ${hoursAdded} teaching hours credited to ${partner.name}.`, 'success');

    // Refresh view
    renderDashboardTab();
    renderExploreGrid();
  });
}

function highlightStars(rating) {
  const starButtons = document.querySelectorAll('.star-btn');
  starButtons.forEach(btn => {
    const btnRating = parseInt(btn.getAttribute('data-rating'));
    btn.classList.toggle('selected', btnRating <= rating);
  });
}

function openRatingModal(partnerId, sessionMinutes) {
  const partner = getUserById(partnerId);
  if (!partner) return;

  document.getElementById('ratingTargetUserId').value = partner.id;
  document.getElementById('ratingSessionMinutes').value = sessionMinutes;
  document.getElementById('ratingPartnerName').textContent = partner.name;
  document.getElementById('ratingDurationText').textContent = `${sessionMinutes} mins`;
  document.getElementById('reviewCommentInput').value = '';

  AppState.selectedRating = 5;
  highlightStars(5);

  const modal = document.getElementById('ratingModal');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeRatingModal() {
  const modal = document.getElementById('ratingModal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

/* ==============================================================================
   SECTION 9: PROFILE DASHBOARD & INTERACTIVE SKILL MANAGEMENT
   Displays teaching hours, star ratings, skills taught & learned,
   and lets the user add/remove skills dynamically.
   ============================================================================== */

function setupDashboard() {
  const btnAddTeachSkill = document.getElementById('btnAddTeachSkill');
  const btnAddLearnSkill = document.getElementById('btnAddLearnSkill');
  const btnOpenEditProfile = document.getElementById('btnOpenEditProfile');
  const btnEditAvatar = document.getElementById('btnEditAvatar');

  // Add Skill Modal Triggers
  btnAddTeachSkill.addEventListener('click', () => openAddSkillModal('teach'));
  btnAddLearnSkill.addEventListener('click', () => openAddSkillModal('learn'));

  // Setup Add Skill Modal Form
  const skillModal = document.getElementById('addSkillModal');
  const btnCloseSkill = document.getElementById('btnCloseSkillModal');
  const btnCancelSkill = document.getElementById('btnCancelSkillModal');
  const skillForm = document.getElementById('addSkillForm');

  btnCloseSkill.addEventListener('click', () => closeAddSkillModal());
  btnCancelSkill.addEventListener('click', () => closeAddSkillModal());

  skillForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('skillType').value;
    const name = document.getElementById('skillNameInput').value.trim();
    const category = document.getElementById('skillCategorySelect').value;
    const proficiency = document.getElementById('skillProficiencySelect').value;

    if (!name) return;

    const currentUser = getCurrentUser();
    const newSkill = {
      id: 'skill_' + Date.now(),
      name,
      category,
      proficiency: type === 'teach' ? proficiency : undefined
    };

    if (type === 'teach') {
      currentUser.teachSkills.push(newSkill);
      showToast(`Added "${name}" to skills you teach!`, 'success');
    } else {
      currentUser.learnSkills.push(newSkill);
      showToast(`Added "${name}" to skills you want to learn!`, 'success');
    }

    saveUsers();
    closeAddSkillModal();
    renderDashboardTab();
    renderExploreGrid();
  });

  // Edit Profile Modal
  const editModal = document.getElementById('editProfileModal');
  const btnCloseEdit = document.getElementById('btnCloseEditProfileModal');
  const btnCancelEdit = document.getElementById('btnCancelEditProfile');
  const editForm = document.getElementById('editProfileForm');

  btnOpenEditProfile.addEventListener('click', () => {
    const user = getCurrentUser();
    document.getElementById('editProfileName').value = user.name;
    document.getElementById('editProfileRole').value = user.headline;
    document.getElementById('editProfileBio').value = user.bio;
    editModal.classList.add('show');
  });

  btnEditAvatar.addEventListener('click', () => {
    const newAvatar = prompt('Enter image URL for avatar:', getCurrentUser().avatar);
    if (newAvatar && newAvatar.trim().startsWith('http')) {
      getCurrentUser().avatar = newAvatar.trim();
      saveUsers();
      updateNavbarUserInfo();
      renderDashboardTab();
      showToast('Avatar updated!', 'success');
    }
  });

  btnCloseEdit.addEventListener('click', () => editModal.classList.remove('show'));
  btnCancelEdit.addEventListener('click', () => editModal.classList.remove('show'));

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    user.name = document.getElementById('editProfileName').value.trim();
    user.headline = document.getElementById('editProfileRole').value.trim();
    user.bio = document.getElementById('editProfileBio').value.trim();

    saveUsers();
    editModal.classList.remove('show');
    updateNavbarUserInfo();
    renderDashboardTab();
    showToast('Profile updated successfully!', 'success');
  });
}

function openAddSkillModal(type) {
  document.getElementById('skillType').value = type;
  document.getElementById('skillNameInput').value = '';
  const isTeach = type === 'teach';

  document.getElementById('addSkillModalTitle').textContent = isTeach ? 'Add a Skill You Can Teach' : 'Add a Skill You Want to Learn';
  document.getElementById('addSkillModalSubtitle').textContent = isTeach ? 'Share your expertise and mentor peers.' : 'Add to your learning wishlist.';
  document.getElementById('proficiencyGroup').style.display = isTeach ? 'block' : 'none';

  const modal = document.getElementById('addSkillModal');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeAddSkillModal() {
  const modal = document.getElementById('addSkillModal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

function renderDashboardTab() {
  const user = getCurrentUser();

  // Profile Header Card
  document.getElementById('dashUserAvatar').src = user.avatar;
  document.getElementById('dashUserName').textContent = user.name;
  document.getElementById('dashUserRole').textContent = user.headline;
  document.getElementById('dashUserBio').textContent = user.bio;
  document.getElementById('dashUserTier').innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
    ${user.tier || 'Verified Mentor'}
  `;

  // 4 Key Metric Cards (Taught, Learned, Rating, Hours)
  document.getElementById('dashSkillsTaughtCount').textContent = user.completedSkillsTaught || 0;
  document.getElementById('dashSkillsLearnedCount').textContent = user.completedSkillsLearned || 0;
  document.getElementById('dashStarRatingAvg').textContent = user.ratingAvg.toFixed(1);
  document.getElementById('dashReviewsCount').textContent = user.reviewsCount;
  document.getElementById('dashHoursTaught').textContent = user.hoursTaught.toFixed(1);

  // Star visual
  const starCount = Math.floor(user.ratingAvg);
  document.getElementById('dashStarStars').textContent = '★'.repeat(starCount) + (user.ratingAvg % 1 >= 0.5 ? '½' : '');

  // Skills Taught List
  document.getElementById('dashTeachSkillsListCount').textContent = user.teachSkills.length;
  const teachContainer = document.getElementById('dashTeachSkillsContainer');
  teachContainer.innerHTML = user.teachSkills.map(s => `
    <div class="interactive-skill-pill teach">
      <span>${s.name} (${s.proficiency || 'Advanced'})</span>
      <button class="btn-remove-skill" onclick="removeSkill('teach', '${s.id}')" title="Remove skill">&times;</button>
    </div>
  `).join('');

  // Skills Learned List
  document.getElementById('dashLearnSkillsListCount').textContent = user.learnSkills.length;
  const learnContainer = document.getElementById('dashLearnSkillsContainer');
  learnContainer.innerHTML = user.learnSkills.map(s => `
    <div class="interactive-skill-pill learn">
      <span>${s.name}</span>
      <button class="btn-remove-skill" onclick="removeSkill('learn', '${s.id}')" title="Remove skill">&times;</button>
    </div>
  `).join('');

  // Testimonials & Reviews Grid
  const reviewsContainer = document.getElementById('dashReviewsContainer');
  if (!user.reviews || user.reviews.length === 0) {
    reviewsContainer.innerHTML = `
      <p style="color:var(--text-muted); font-size:0.85rem;">No reviews logged yet. Complete a video call to earn your first rating!</p>
    `;
  } else {
    reviewsContainer.innerHTML = user.reviews.map(rev => `
      <div class="review-item-card">
        <div class="review-item-header">
          <span class="reviewer-name">${rev.reviewerName}</span>
          <span class="review-stars">${'★'.repeat(Math.round(rev.rating))}</span>
        </div>
        <p class="review-text">"${rev.comment}"</p>
        <span class="review-date">${rev.date}</span>
      </div>
    `).join('');
  }
}

/**
 * Remove skill from user's teach or learn collection
 */
window.removeSkill = function(type, skillId) {
  const user = getCurrentUser();
  if (type === 'teach') {
    user.teachSkills = user.teachSkills.filter(s => s.id !== skillId);
  } else {
    user.learnSkills = user.learnSkills.filter(s => s.id !== skillId);
  }
  saveUsers();
  renderDashboardTab();
  renderExploreGrid();
  showToast('Skill removed from profile', 'info');
};

/* ==============================================================================
   SECTION 10: REGISTRATION & NEW USER CREATION
   ============================================================================== */

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=250&q=80'
];

// Domain existence checker via DNS-over-HTTPS
const APP_KNOWN_PROVIDERS = new Set(['gmail.com','googlemail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','proton.me','protonmail.com','zoho.com','aol.com','mail.com']);
const APP_DOMAIN_TYPOS = { 'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'yaho.com': 'yahoo.com', 'hotmial.com': 'hotmail.com', 'outlok.com': 'outlook.com', 'iclud.com': 'icloud.com' };

async function verifyAppEmailDomain(domain) {
  const dom = (domain || '').trim().toLowerCase();
  if (APP_KNOWN_PROVIDERS.has(dom)) return { exists: true };
  if (APP_DOMAIN_TYPOS[dom]) return { exists: false, typo: APP_DOMAIN_TYPOS[dom] };
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(dom)}&type=MX`);
    if (res.ok) {
      const data = await res.json();
      if (data.Status === 3) return { exists: false, reason: 'nxdomain' };
      if (data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0) return { exists: true };
    }
  } catch (e) {}
  return { exists: true };
}

function setupRegistration() {
  const modal = document.getElementById('registerModal');
  const btnOpen = document.getElementById('btnOpenRegisterModal');
  const btnClose = document.getElementById('btnCloseRegisterModal');
  const btnCancel = document.getElementById('btnCancelRegisterModal');
  const form = document.getElementById('registerForm');
  const avatarContainer = document.getElementById('avatarSelectionRow');

  // Populate avatar options
  avatarContainer.innerHTML = AVATAR_PRESETS.map((url, i) => `
    <img src="${url}" alt="Avatar ${i+1}" class="avatar-option ${i === 0 ? 'selected' : ''}" onclick="selectRegisterAvatar('${url}', this)" />
  `).join('');
  document.getElementById('regSelectedAvatar').value = AVATAR_PRESETS[0];

  btnOpen.addEventListener('click', () => {
    document.getElementById('userDropdown').classList.remove('show');
    modal.classList.add('show');
  });

  btnClose.addEventListener('click', () => modal.classList.remove('show'));
  btnCancel.addEventListener('click', () => modal.classList.remove('show'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('regFullName').value.trim();
    const headline = document.getElementById('regHeadline').value.trim();
    const bio = document.getElementById('regBio').value.trim();
    const rawTeach = document.getElementById('regTeachSkills').value.trim();
    const rawLearn = document.getElementById('regLearnSkills').value.trim();
    const avatar = document.getElementById('regSelectedAvatar')?.value || AVATAR_PRESETS[0];
    const emailInput = document.getElementById('regEmail') || document.getElementById('suEmail');
    const email = emailInput ? emailInput.value.trim() : '';

    if (email) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!emailRegex.test(email) || !email.includes('.')) {
        showToast('Please enter a valid email address (e.g. name@domain.com)', 'info');
        return;
      }
      const domain = email.split('@')[1].toLowerCase();
      if (APP_DOMAIN_TYPOS[domain]) {
        showToast(`Did you mean @${APP_DOMAIN_TYPOS[domain]}? Please fix domain typo.`, 'info');
        return;
      }
      const alreadyExists = AppState.users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase());
      if (alreadyExists) {
        showToast('An account with this email already exists!', 'info');
        return;
      }
      // Real domain existence check via DNS
      const domainCheck = await verifyAppEmailDomain(domain);
      if (!domainCheck.exists) {
        showToast(`The email domain @${domain} does not exist on the internet!`, 'info');
        return;
      }
    }

    if (!fullName || !headline) return;

    // Convert comma-separated string to skills array
    const teachSkills = rawTeach.split(',').map(s => s.trim()).filter(Boolean).map(name => ({
      id: 's_' + Math.random().toString(36).substr(2, 6),
      name,
      category: 'Coding',
      proficiency: 'Advanced'
    }));

    const learnSkills = rawLearn.split(',').map(s => s.trim()).filter(Boolean).map(name => ({
      id: 'l_' + Math.random().toString(36).substr(2, 6),
      name,
      category: 'Design'
    }));

    const newUser = {
      id: 'user_' + Date.now(),
      name: fullName,
      headline,
      bio,
      avatar,
      tier: 'Active Swapper',
      hoursTaught: 0.0,
      ratingAvg: 5.0,
      reviewsCount: 0,
      completedSkillsTaught: 0,
      completedSkillsLearned: 0,
      teachSkills: teachSkills.length > 0 ? teachSkills : [{ id: 's0', name: 'Web Basics', category: 'Coding', proficiency: 'Advanced' }],
      learnSkills: learnSkills.length > 0 ? learnSkills : [{ id: 'l0', name: 'UI Design', category: 'Design' }],
      reviews: []
    };

    AppState.users.unshift(newUser);
    saveUsers();

    // Switch active user to this new account
    AppState.activeUserId = newUser.id;
    saveActiveUser();

    modal.classList.remove('show');
    form.reset();

    updateNavbarUserInfo();
    renderUserDropdown();
    switchTab('dashboard');
    showToast(`Welcome to SkillSwap, ${fullName}! Your profile is ready.`, 'success');
  });
}

window.selectRegisterAvatar = function(url, el) {
  document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('regSelectedAvatar').value = url;
};

/* ==============================================================================
   SECTION 11: TOAST NOTIFICATIONS
   ============================================================================== */

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'success' 
    ? `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

  toast.innerHTML = `
    ${iconSvg}
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Automatically remove toast after 3.5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ==============================================================================
   DOM READY INITIALIZATION
   ============================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize data from storage or seed
  initializeData();

  // 2. Setup components & event listeners
  setupUserSwitcher();
  setupNavigation();
  setupExploreFilters();
  setupSwapRequestModal();
  setupRequestsView();
  setupVideoCallSystem();
  setupRatingSystem();
  setupDashboard();
  setupRegistration();

  // 3. Render initial views
  updateNavbarUserInfo();
  renderExploreGrid();
  renderRequestsTab();
  renderDashboardTab();

  console.log('SkillSwap App initialized successfully! Built with pure HTML/CSS/JS.');
});
