// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
// User's Real Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9oD5fnN-KtkyKqDFC926nnHhhlHcoLVY",
  authDomain: "spanishflashcards-77c83.firebaseapp.com",
  databaseURL: "https://spanishflashcards-77c83-default-rtdb.firebaseio.com",
  projectId: "spanishflashcards-77c83",
  storageBucket: "spanishflashcards-77c83.firebasestorage.app",
  messagingSenderId: "1054445680012",
  appId: "1:1054445680012:web:8d861ba67ffe5dda9b52a9",
  measurementId: "G-RMK7MYXNHV"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const cardsRef = db.ref('cards');

// No default cards - user will upload their own list.

let cards = []; // Local mirror of Firebase data
let activePile = 'remaining'; // 'remaining', 'known', 'needPractice'
let currentCardId = null;
let currentMode = 'word-first'; // 'word-first', 'definition-first'
let currentUser = null; // 'J' or 'R'

// ==========================================
// CACHE DOM ELEMENTS
// ==========================================
const DOM = {};
function cacheDOM() {
    DOM.studyMode = document.getElementById('study-mode');
    DOM.btnAddWord = document.getElementById('btn-add-word');
    DOM.btnShuffle = document.getElementById('btn-shuffle');
    DOM.btnReset = document.getElementById('btn-reset');
    
    DOM.piles = document.querySelectorAll('.pile');
    DOM.countRemaining = document.getElementById('count-remaining');
    DOM.countKnown = document.getElementById('count-known');
    DOM.countNeedPractice = document.getElementById('count-needPractice');
    
    DOM.flashcardContainer = document.getElementById('flashcard-container');
    DOM.flashcard = document.getElementById('flashcard');
    DOM.actionButtons = document.getElementById('action-buttons');
    DOM.completionMessage = document.getElementById('completion-message');
    DOM.completionText = document.getElementById('completion-text');
    
    DOM.frontPrimary = document.getElementById('front-primary');
    DOM.frontSecondary = document.getElementById('front-secondary');
    DOM.backPrimary = document.getElementById('back-primary');
    DOM.backSecondary = document.getElementById('back-secondary');
    
    DOM.btnYes = document.getElementById('btn-yes');
    DOM.btnNo = document.getElementById('btn-no');
    
    DOM.btnMoreOptions = document.querySelectorAll('.btn-more-options');
    DOM.menuDropdowns = document.querySelectorAll('.menu-dropdown');
    DOM.btnDeleteCards = [document.getElementById('btn-delete-card'), document.getElementById('btn-delete-card-back')];
    
    // Modals
    DOM.modalAdd = document.getElementById('modal-add');
    DOM.formAddWord = document.getElementById('form-add-word');
    DOM.btnCloseModalAdd = DOM.modalAdd.querySelector('.btn-close-modal');
    DOM.btnCancelModalAdd = DOM.modalAdd.querySelector('.btn-cancel-modal');
    
    DOM.modalDelete = document.getElementById('modal-delete');
    DOM.btnConfirmDelete = document.getElementById('btn-confirm-delete');
    DOM.btnCancelDelete = DOM.modalDelete.querySelector('.btn-cancel-delete');
    
    DOM.modalIdentity = document.getElementById('modal-identity');
    DOM.btnIdentityJ = document.getElementById('btn-identity-j');
    DOM.btnIdentityR = document.getElementById('btn-identity-r');
    
    // Header Toggles
    DOM.toggleJ = document.getElementById('toggle-j');
    DOM.toggleR = document.getElementById('toggle-r');
    
    // Stickers
    DOM.stickers = {
        frontJ: document.getElementById('sticker-front-j'),
        frontR: document.getElementById('sticker-front-r'),
        backJ: document.getElementById('sticker-back-j'),
        backR: document.getElementById('sticker-back-r'),
    };
}

// ==========================================
// INITIALIZATION & IDENTITY
// ==========================================
function init() {
    cacheDOM();
    
    currentUser = localStorage.getItem('vocabCurrentUser');
    if (!currentUser) {
        DOM.modalIdentity.classList.remove('hidden');
        
        DOM.btnIdentityJ.addEventListener('click', () => {
            DOM.modalIdentity.classList.add('hidden');
            switchUser('J');
            startApp();
        });
        DOM.btnIdentityR.addEventListener('click', () => {
            DOM.modalIdentity.classList.add('hidden');
            switchUser('R');
            startApp();
        });
    } else {
        if (currentUser === 'J') DOM.toggleJ.classList.add('active');
        else DOM.toggleR.classList.add('active');
        
        startApp();
    }
}

function switchUser(user) {
    currentUser = user;
    localStorage.setItem('vocabCurrentUser', user);
    
    if (user === 'J') {
        DOM.toggleJ.classList.add('active');
        DOM.toggleR.classList.remove('active');
    } else {
        DOM.toggleR.classList.add('active');
        DOM.toggleJ.classList.remove('active');
    }
    activePile = 'remaining';
    activeQueue = [];
    updateUI();
}

function startApp() {
    bindEvents();
    setupFirebaseListeners();
}

// ==========================================
// FIREBASE LOGIC
// ==========================================
function setupFirebaseListeners() {
    // Real-time listener
    cardsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        cards = [];
        if (data) {
            Object.values(data).forEach(card => {
                // Ensure properties exist to avoid errors
                if (!card.piles) card.piles = { J: 'remaining', R: 'remaining' };
                if (!card.knownBy) card.knownBy = {};
                cards.push(card);
            });
        }
        
        updateUI();
    });
}

function updateCardInFirebase(cardId, updates) {
    cardsRef.child(cardId).update(updates);
}

// ==========================================
// BIND EVENTS
// ==========================================
function bindEvents() {
    DOM.toggleJ.addEventListener('click', () => { if(currentUser !== 'J') switchUser('J'); });
    DOM.toggleR.addEventListener('click', () => { if(currentUser !== 'R') switchUser('R'); });

    DOM.studyMode.addEventListener('change', (e) => {
        currentMode = e.target.value;
        if (currentCardId) renderCard(getCurrentCard());
    });

    DOM.piles.forEach(pile => {
        pile.addEventListener('click', () => {
            const pileName = pile.dataset.pile;
            if (activePile !== pileName) {
                activePile = pileName;
                updatePilesUI();
                nextCard(true);
            }
        });
    });

    DOM.flashcard.addEventListener('click', (e) => {
        if(e.target.closest('.btn-more-options') || e.target.closest('.menu-dropdown')) return;
        DOM.flashcard.classList.toggle('is-flipped');
    });

    DOM.btnYes.addEventListener('click', () => handleAction('known'));
    DOM.btnNo.addEventListener('click', () => handleAction('needPractice'));

    DOM.btnShuffle.addEventListener('click', shuffleActivePile);
    DOM.btnReset.addEventListener('click', resetAllPiles);
    
    // Add Word
    DOM.btnAddWord.addEventListener('click', () => showModal(DOM.modalAdd));
    DOM.btnCloseModalAdd.addEventListener('click', () => hideModal(DOM.modalAdd));
    DOM.btnCancelModalAdd.addEventListener('click', () => hideModal(DOM.modalAdd));
    DOM.formAddWord.addEventListener('submit', handleAddWord);

    // Menus & Delete
    DOM.btnMoreOptions.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = e.currentTarget.nextElementSibling;
            dropdown.classList.toggle('hidden');
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-more-options')) {
            DOM.menuDropdowns.forEach(menu => menu.classList.add('hidden'));
        }
    });

    DOM.btnDeleteCards.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.menuDropdowns.forEach(menu => menu.classList.add('hidden'));
            showModal(DOM.modalDelete);
        });
    });
    DOM.btnCancelDelete.addEventListener('click', () => hideModal(DOM.modalDelete));
    DOM.btnConfirmDelete.addEventListener('click', handleDeleteConfirm);

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(e) {
    // Don't trigger shortcuts if user is typing in an input or if a modal is open
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    const isAnyModalOpen = !DOM.modalIdentity.classList.contains('hidden') || 
                           !DOM.modalAdd.classList.contains('hidden') || 
                           !DOM.modalDelete.classList.contains('hidden');
                           
    if (isAnyModalOpen || !currentCardId) return;

    if (e.code === 'Space') {
        e.preventDefault(); // prevent page scrolling
        DOM.flashcard.classList.toggle('is-flipped');
    } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleAction('needPractice');
    } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleAction('known');
    }
}

// ==========================================
// CORE LOGIC & UI UPDATES
// ==========================================
function getCardsInPile(pileName) {
    // We only care about the CURRENT USER's pile
    return cards.filter(card => card.piles[currentUser] === pileName);
}

function getCurrentCard() {
    return cards.find(card => card.id === currentCardId);
}

function updateUI() {
    updateCounts();
    updatePilesUI();
    
    // If the current card is no longer in the active pile (e.g., deleted or moved), show next
    const currentCard = getCurrentCard();
    if (!currentCard || currentCard.piles[currentUser] !== activePile) {
        nextCard(true);
    } else {
        // Just re-render to update stickers
        renderCard(currentCard);
    }
}

function updateCounts() {
    DOM.countRemaining.textContent = getCardsInPile('remaining').length;
    DOM.countKnown.textContent = getCardsInPile('known').length;
    DOM.countNeedPractice.textContent = getCardsInPile('needPractice').length;
}

function updatePilesUI() {
    DOM.piles.forEach(pile => {
        if (pile.dataset.pile === activePile) {
            pile.classList.add('indicator-active');
        } else {
            pile.classList.remove('indicator-active');
        }
    });
}

function renderCard(card) {
    DOM.flashcard.classList.remove('is-flipped');
    
    // Update Stickers
    const knowsJ = card.knownBy && card.knownBy.J === true;
    const knowsR = card.knownBy && card.knownBy.R === true;
    
    if (knowsJ) {
        DOM.stickers.frontJ.classList.remove('hidden');
        DOM.stickers.backJ.classList.remove('hidden');
    } else {
        DOM.stickers.frontJ.classList.add('hidden');
        DOM.stickers.backJ.classList.add('hidden');
    }

    if (knowsR) {
        DOM.stickers.frontR.classList.remove('hidden');
        DOM.stickers.backR.classList.remove('hidden');
    } else {
        DOM.stickers.frontR.classList.add('hidden');
        DOM.stickers.backR.classList.add('hidden');
    }
    
    // Update Text Content
    setTimeout(() => {
        if (currentMode === 'word-first') {
            DOM.frontPrimary.textContent = card.word;
            DOM.frontSecondary.textContent = card.pronunciation;
            DOM.frontSecondary.classList.remove('hidden');
            DOM.backPrimary.textContent = card.definition;
            DOM.backSecondary.classList.add('hidden');
        } else {
            DOM.frontPrimary.textContent = card.definition;
            DOM.frontSecondary.classList.add('hidden');
            DOM.backPrimary.textContent = card.word;
            DOM.backSecondary.textContent = card.pronunciation;
            DOM.backSecondary.classList.remove('hidden');
        }
    }, 100);
}

// Temporary variable to hold the order of cards
let activeQueue = [];

function nextCard(immediate = false) {
    const validIds = getCardsInPile(activePile).map(c => c.id);
    
    // Clean up queue: remove cards that are no longer in the pile
    activeQueue = activeQueue.filter(id => validIds.includes(id));
    
    // Add any new cards to the back of the queue
    validIds.forEach(id => {
        if (!activeQueue.includes(id)) activeQueue.push(id);
    });
    
    const displayNext = () => {
        if (activeQueue.length > 0) {
            currentCardId = activeQueue[0];
            renderCard(getCurrentCard());
            
            DOM.flashcardContainer.classList.remove('hidden');
            DOM.actionButtons.classList.remove('hidden');
            DOM.completionMessage.classList.add('hidden');
        } else {
            currentCardId = null;
            DOM.flashcardContainer.classList.add('hidden');
            DOM.actionButtons.classList.add('hidden');
            DOM.completionMessage.classList.remove('hidden');
        }
        
        DOM.flashcard.classList.remove('fade-out');
    };

    if (immediate) displayNext();
    else {
        DOM.flashcard.classList.add('fade-out');
        setTimeout(displayNext, 200);
    }
}

function handleAction(targetPile) {
    if (!currentCardId) return;
    
    // If we are placing the card in the same pile it's already in
    // (e.g. clicking Checkmark while in Known pile), cycle it to the back!
    if (targetPile === activePile) {
        const id = activeQueue.shift();
        activeQueue.push(id);
        nextCard();
        return;
    }
    
    const card = getCurrentCard();
    
    // Remove from queue immediately so it doesn't flash before firebase syncs
    activeQueue = activeQueue.filter(id => id !== currentCardId);
    
    // Update the pile for the CURRENT user only
    const updates = {};
    updates[`piles/${currentUser}`] = targetPile;
    
    // If they clicked "Known", add their sticker!
    if (targetPile === 'known') {
        updates[`knownBy/${currentUser}`] = true;
    }

    updateCardInFirebase(currentCardId, updates);
}

// ==========================================
// HEADER ACTIONS
// ==========================================
function shuffleActivePile() {
    if (activeQueue.length <= 1) return;
    
    // Fisher-Yates shuffle the queue
    for (let i = activeQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [activeQueue[i], activeQueue[j]] = [activeQueue[j], activeQueue[i]];
    }
    
    DOM.flashcard.classList.add('fade-out');
    setTimeout(() => {
        nextCard(true);
        DOM.flashcard.classList.remove('fade-out');
    }, 200);
}

function resetAllPiles() {
    // Find all cards where this user's pile is NOT remaining
    const updates = {};
    cards.forEach(card => {
        if (card.piles[currentUser] !== 'remaining') {
            updates[`${card.id}/piles/${currentUser}`] = 'remaining';
        }
    });
    
    if (Object.keys(updates).length > 0) {
        cardsRef.update(updates);
    }
    
    activePile = 'remaining';
    activeQueue = [];
    updateUI();
}

function handleAddWord(e) {
    e.preventDefault();
    const word = document.getElementById('input-word').value.trim();
    const pronunciation = document.getElementById('input-pronunciation').value.trim() || '';
    const definition = document.getElementById('input-definition').value.trim();
    
    if (word && definition) {
        const newRef = cardsRef.push();
        newRef.set({
            id: newRef.key,
            word,
            pronunciation,
            definition,
            piles: { J: 'remaining', R: 'remaining' },
            knownBy: {}
        });
        
        DOM.formAddWord.reset();
        hideModal(DOM.modalAdd);
    }
}

function handleDeleteConfirm() {
    if (currentCardId) {
        cardsRef.child(currentCardId).remove();
        hideModal(DOM.modalDelete);
    }
}

// ==========================================
// MODAL UTILS
// ==========================================
function showModal(modal) {
    modal.classList.remove('hidden');
    const firstInput = modal.querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

function hideModal(modal) {
    modal.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);
