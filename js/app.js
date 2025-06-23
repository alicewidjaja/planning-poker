// Global variables
let socket;
let currentUser = {
    id: null,
    name: '',
    role: '',
    vote: null
};
let roomId = null;
let participants = [];
let votesRevealed = false;
let currentStory = null;
let jiraConnection = {
    connected: false,
    url: '',
    email: '',
    token: ''
};

// Timer variables
let timerInterval = null;
let timerValue = 10;
let timerRunning = false;

// DOM Elements
const domElements = {
    roomId: document.getElementById('room-id'),
    copyRoomLink: document.getElementById('copy-room-link'),
    createNewRoom: document.getElementById('create-new-room'),
    participantsList: document.getElementById('participants-list'),
    userName: document.getElementById('user-name'),
    userRole: document.getElementById('user-role'),
    joinSession: document.getElementById('join-session'),
    timerValue: document.getElementById('timer-value'),
    startTimer: document.getElementById('start-timer'),
    resetTimer: document.getElementById('reset-timer'),
    cardDeck: document.querySelector('.card-deck'),
    selectedVote: document.getElementById('selected-vote'),
    revealVotes: document.getElementById('reveal-votes'),
    resetVoting: document.getElementById('reset-voting'),
    votesCount: document.getElementById('votes-count'),
    participantsCount: document.getElementById('participants-count'),
    resultsDisplay: document.getElementById('results-display'),
    voteCardsContainer: document.getElementById('vote-cards-container'),
    averageVote: document.getElementById('average-vote'),
    medianVote: document.getElementById('median-vote'),
    modeVote: document.getElementById('mode-vote'),
    jiraUrl: document.getElementById('jira-url'),
    jiraEmail: document.getElementById('jira-email'),
    jiraToken: document.getElementById('jira-token'),
    jiraConnect: document.getElementById('jira-connect'),
    jiraConnectedSection: document.getElementById('jira-connected-section'),
    jiraLoginSection: document.getElementById('jira-login-section'),
    jiraIssue: document.getElementById('jira-issue'),
    loadIssue: document.getElementById('load-issue'),
    disconnectJira: document.getElementById('disconnect-jira'),
    storyTitle: document.getElementById('story-title'),
    storyDescription: document.getElementById('story-description'),
    storyLink: document.getElementById('story-link'),
    storyDetails: document.getElementById('story-details'),
    noStoryMessage: document.getElementById('no-story-message'),
    addManualStory: document.getElementById('add-manual-story'),
    manualStoryForm: document.getElementById('manual-story-form'),
    manualStoryTitle: document.getElementById('manual-story-title'),
    manualStoryDescription: document.getElementById('manual-story-description'),
    submitManualStory: document.getElementById('submit-manual-story')
};

// Initialize the application
function init() {
    // Check if there's a room ID in the URL
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('room');

    if (roomId) {
        // Connect to existing room
        domElements.roomId.textContent = `Room: ${roomId}`;
        initializeSocket();
    } else {
        // Create a new room
        createNewRoom();
    }

    // Set up event listeners
    setupEventListeners();
}

// Set up all event listeners
function setupEventListeners() {
    // Room management
    domElements.copyRoomLink.addEventListener('click', copyRoomLink);
    domElements.createNewRoom.addEventListener('click', createNewRoom);

    // User management
    domElements.joinSession.addEventListener('click', joinSession);

    // Voting
    domElements.cardDeck.addEventListener('click', handleCardClick);
    
    // Moderator controls
    domElements.revealVotes.addEventListener('click', revealVotes);
    domElements.resetVoting.addEventListener('click', resetVoting);
    
    // Timer controls
    domElements.startTimer.addEventListener('click', startTimer);
    domElements.resetTimer.addEventListener('click', resetTimerFunction);

    // JIRA integration
    domElements.jiraConnect.addEventListener('click', connectToJira);
    domElements.loadIssue.addEventListener('click', loadJiraIssue);
    domElements.disconnectJira.addEventListener('click', disconnectJira);

    // Manual story
    domElements.addManualStory.addEventListener('click', () => {
        domElements.manualStoryForm.classList.toggle('hidden');
    });
    domElements.submitManualStory.addEventListener('click', addManualStory);
}

// Initialize WebSocket connection
function initializeSocket() {
    console.log('Connecting to WebSocket server...');
    
    // Connect to the real Socket.IO server
    socket = io();
    
    // Set up socket event listeners
    setupSocketListeners();
}

// Set up Socket.IO event listeners
function setupSocketListeners() {
    // Connection established
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
    });
    
    // Room joined
    socket.on('room-joined', (data) => {
        console.log('Room joined:', data);
        
        // Update participants list
        participants = data.participants;
        
        // Update current user info
        currentUser.id = socket.id;
        
        // Update story if available
        if (data.story) {
            currentStory = data.story;
            displayStory();
        }
        
        // Update votes revealed status
        votesRevealed = data.votesRevealed;
        if (votesRevealed) {
            displayResults();
        }
        
        // Update UI
        updateParticipantsList();
        updateVotingStatus();
        updateModeratorControls();
        
        // Hide join form
        document.querySelector('.user-controls').innerHTML = `
            <h3>Your Info</h3>
            <p><strong>Name:</strong> ${currentUser.name}</p>
            <p><strong>Role:</strong> ${currentUser.role}</p>
        `;
    });
    
    // Participant joined
    socket.on('participant-joined', (participant) => {
        console.log('Participant joined:', participant);
        
        // Add participant to list
        participants.push(participant);
        
        // Update UI
        updateParticipantsList();
        updateVotingStatus();
    });
    
    // Participant left
    socket.on('participant-left', (data) => {
        console.log('Participant left:', data);
        
        // Remove participant from list
        const index = participants.findIndex(p => p.id === data.id);
        if (index !== -1) {
            participants.splice(index, 1);
        }
        
        // Update UI
        updateParticipantsList();
        updateVotingStatus();
    });
    
    // Vote submitted
    socket.on('vote-submitted', (data) => {
        console.log('Vote submitted:', data);
        
        // Update participant's vote status
        const index = participants.findIndex(p => p.id === data.participantId);
        if (index !== -1) {
            participants[index].hasVoted = data.hasVoted;
        }
        
        // Update UI
        updateParticipantsList();
        updateVotingStatus();
    });
    
    // Votes revealed
    socket.on('votes-revealed', (data) => {
        console.log('Votes revealed:', data);
        
        // Update participants with their votes
        participants = data.participants;
        
        // Set votes revealed flag
        votesRevealed = true;
        
        // Update UI
        updateParticipantsList();
        displayResults();
    });
    
    // Voting reset
    socket.on('voting-reset', (data) => {
        console.log('Voting reset:', data);
        
        // Update participants
        participants = data.participants;
        
        // Reset current user's vote
        currentUser.vote = null;
        domElements.selectedVote.textContent = 'None';
        
        // Reset UI
        votesRevealed = false;
        domElements.resultsDisplay.classList.add('hidden');
        
        // Remove selected class from all cards
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => card.classList.remove('selected'));
        
        // Update UI
        updateParticipantsList();
        updateVotingStatus();
    });
    
    // Story added
    socket.on('story-added', (story) => {
        console.log('Story added:', story);
        
        // Update current story
        currentStory = story;
        
        // Display story
        displayStory();
    });
    
    // Timer events
    socket.on('timer-started', () => {
        // Only start the timer if it's not already running
        if (!timerRunning) {
            startTimer();
        }
    });
    
    socket.on('timer-reset', () => {
        resetTimerFunction();
    });
    
    // Connection error
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        alert('Failed to connect to the server. Please try again later.');
    });
    
    // Disconnected
    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });
}

// These functions are no longer needed as we're using real WebSocket communication
// The socket.on event handlers in setupSocketListeners() replace them

// Create a new room
function createNewRoom() {
    // Generate a random room ID
    roomId = generateRoomId();
    
    // Update URL without reloading the page
    window.history.pushState({}, '', `?room=${roomId}`);
    
    // Update UI
    domElements.roomId.textContent = `Room: ${roomId}`;
    
    // Initialize WebSocket connection
    initializeSocket();
}

// Copy room link to clipboard
function copyRoomLink() {
    const roomLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(roomLink).then(() => {
        alert('Room link copied to clipboard!');
    });
}

// Join the session
function joinSession() {
    const name = domElements.userName.value.trim();
    const role = domElements.userRole.value;
    
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    // Save user info
    currentUser.name = name;
    currentUser.role = role;
    
    // Emit join room event
    socket.emit('join-room', {
        roomId: roomId,
        name: name,
        role: role
    });
}

// Handle card click
function handleCardClick(event) {
    if (!event.target.classList.contains('card')) return;
    
    // Get the card value
    const value = event.target.dataset.value;
    
    // Update the user's vote
    currentUser.vote = value;
    
    // Update UI
    domElements.selectedVote.textContent = value;
    
    // Remove selected class from all cards
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => card.classList.remove('selected'));
    
    // Add selected class to the clicked card
    event.target.classList.add('selected');
    
    // Emit submit vote event
    socket.emit('submit-vote', {
        vote: value
    });
}

// Reveal votes
function revealVotes() {
    socket.emit('reveal-votes');
}

// Reset voting
function resetVoting() {
    socket.emit('reset-voting', { roomId });
    // Also reset the timer when voting is reset
    resetTimerFunction();
}

// Connect to JIRA
function connectToJira() {
    const url = domElements.jiraUrl.value.trim();
    const email = domElements.jiraEmail.value.trim();
    const token = domElements.jiraToken.value.trim();
    
    if (!url || !email || !token) {
        alert('Please fill in all JIRA connection fields');
        return;
    }
    
    // In a real application, you would validate the credentials with the JIRA API
    // For this demo, we'll simulate a successful connection
    jiraConnection = {
        connected: true,
        url: url,
        email: email,
        token: token
    };
    
    // Update UI
    domElements.jiraLoginSection.classList.add('hidden');
    domElements.jiraConnectedSection.classList.remove('hidden');
}

// Load JIRA issue
function loadJiraIssue() {
    const issueId = domElements.jiraIssue.value.trim();
    
    if (!issueId) {
        alert('Please enter a JIRA issue ID');
        return;
    }
    
    // In a real application, you would fetch the issue from the JIRA API
    // For this demo, we'll simulate a successful response
    const mockIssue = {
        id: issueId,
        title: `Sample Story: ${issueId}`,
        description: 'This is a sample user story description that would be fetched from JIRA. It includes acceptance criteria and other details relevant to the story.',
        link: `${jiraConnection.url}/browse/${issueId}`
    };
    
    // Update the current story
    currentStory = mockIssue;
    
    // Display the story
    displayStory();
}

// Disconnect from JIRA
function disconnectJira() {
    jiraConnection = {
        connected: false,
        url: '',
        email: '',
        token: ''
    };
    
    // Clear form fields
    domElements.jiraUrl.value = '';
    domElements.jiraEmail.value = '';
    domElements.jiraToken.value = '';
    
    // Update UI
    domElements.jiraLoginSection.classList.remove('hidden');
    domElements.jiraConnectedSection.classList.add('hidden');
}

// Add a manual story
function addManualStory() {
    const title = domElements.manualStoryTitle.value.trim();
    const description = domElements.manualStoryDescription.value.trim();
    
    if (!title) {
        alert('Please enter a story title');
        return;
    }
    
    // Emit add story event
    socket.emit('add-story', {
        title: title,
        description: description,
        link: ''
    });
    
    // Clear form fields
    domElements.manualStoryTitle.value = '';
    domElements.manualStoryDescription.value = '';
    
    // Hide the form
    domElements.manualStoryForm.classList.add('hidden');
}

// Display the current story
function displayStory() {
    if (!currentStory) return;
    
    // Update UI
    domElements.storyTitle.textContent = currentStory.title;
    domElements.storyDescription.textContent = currentStory.description;
    
    if (currentStory.link) {
        domElements.storyLink.innerHTML = `<a href="${currentStory.link}" target="_blank">View in JIRA</a>`;
    } else {
        domElements.storyLink.innerHTML = '';
    }
    
    // Show story details and hide no story message
    domElements.noStoryMessage.classList.add('hidden');
    domElements.storyDetails.classList.remove('hidden');
}

// Update the participants list
function updateParticipantsList() {
    domElements.participantsList.innerHTML = '';
    
    participants.forEach(participant => {
        const li = document.createElement('li');
        
        let statusClass = 'status-waiting';
        let statusText = 'Waiting';
        
        if (participant.role === 'scrum-master' || participant.role === 'product-owner') {
            statusClass = 'status-moderator';
            statusText = participant.role === 'scrum-master' ? 'Scrum Master' : 'Product Owner';
        } else if (participant.hasVoted) {
            statusClass = 'status-voted';
            statusText = 'Voted';
        }
        
        li.innerHTML = `
            <span>
                <span class="participant-status ${statusClass}"></span>
                ${participant.name}
            </span>
            <span>${statusText}</span>
        `;
        
        domElements.participantsList.appendChild(li);
    });
}

// Update the voting status
function updateVotingStatus() {
    const votedCount = participants.filter(p => p.hasVoted).length;
    const totalCount = participants.filter(p => p.role !== 'observer').length;
    
    domElements.votesCount.textContent = votedCount;
    domElements.participantsCount.textContent = totalCount;
}

// Update moderator controls
function updateModeratorControls() {
    const isModerator = currentUser.role === 'scrum-master' || currentUser.role === 'product-owner';
    
    if (isModerator) {
        domElements.revealVotes.disabled = false;
        domElements.resetVoting.disabled = false;
    } else {
        domElements.revealVotes.disabled = true;
        domElements.resetVoting.disabled = true;
    }
}

// Display voting results
function displayResults() {
    if (!votesRevealed) return;
    
    // Clear previous results
    domElements.voteCardsContainer.innerHTML = '';
    
    // Show results display
    domElements.resultsDisplay.classList.remove('hidden');
    
    // Display vote cards
    participants.forEach(participant => {
        if (participant.role !== 'observer' && participant.hasVoted) {
            const voteCard = document.createElement('div');
            voteCard.className = 'vote-card';
            voteCard.innerHTML = `
                <div class="vote-card-value">${participant.vote}</div>
                <div class="vote-card-name">${participant.name}</div>
            `;
            domElements.voteCardsContainer.appendChild(voteCard);
        }
    });
    
    // Calculate statistics
    calculateAndDisplayStatistics();
}

// Calculate and display voting statistics
function calculateAndDisplayStatistics() {
    const votes = participants
        .filter(p => p.role !== 'observer' && p.hasVoted && p.vote !== '?')
        .map(p => parseInt(p.vote))
        .filter(vote => !isNaN(vote));
    
    if (votes.length === 0) {
        domElements.averageVote.textContent = '-';
        domElements.medianVote.textContent = '-';
        domElements.modeVote.textContent = '-';
        return;
    }
    
    // Calculate average
    const sum = votes.reduce((acc, vote) => acc + vote, 0);
    const average = sum / votes.length;
    domElements.averageVote.textContent = average.toFixed(1);
    
    // Calculate median
    const sortedVotes = [...votes].sort((a, b) => a - b);
    let median;
    if (sortedVotes.length % 2 === 0) {
        median = (sortedVotes[sortedVotes.length / 2 - 1] + sortedVotes[sortedVotes.length / 2]) / 2;
    } else {
        median = sortedVotes[Math.floor(sortedVotes.length / 2)];
    }
    domElements.medianVote.textContent = median;
    
    // Calculate mode
    const voteCounts = {};
    votes.forEach(vote => {
        voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });
    
    let maxCount = 0;
    let modes = [];
    
    for (const vote in voteCounts) {
        if (voteCounts[vote] > maxCount) {
            maxCount = voteCounts[vote];
            modes = [vote];
        } else if (voteCounts[vote] === maxCount) {
            modes.push(vote);
        }
    }
    
    domElements.modeVote.textContent = modes.join(', ');
}

// Generate a random room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 10);
}

// Generate a random user ID
function generateUserId() {
    return Math.random().toString(36).substring(2, 15);
}

// Timer functions
function startTimer() {
    if (timerRunning) return;
    
    // Reset timer value to 10 seconds
    timerValue = 10;
    updateTimerDisplay();
    
    // Remove any existing explosion animation
    domElements.timerValue.classList.remove('explosion-animation');
    
    // Start the timer
    timerRunning = true;
    domElements.startTimer.innerHTML = '<i class="fas fa-pause"></i>';
    domElements.startTimer.title = 'Pause Timer';
    
    // Broadcast timer start to all participants if user is moderator
    if (currentUser.role === 'scrum-master' || currentUser.role === 'product-owner') {
        socket.emit('timer-start', { roomId });
    }
    
    // Set up the interval to count down
    timerInterval = setInterval(() => {
        timerValue--;
        updateTimerDisplay();
        
        if (timerValue <= 0) {
            clearInterval(timerInterval);
            timerRunning = false;
            domElements.startTimer.innerHTML = '<i class="fas fa-play"></i>';
            domElements.startTimer.title = 'Start Timer';
            
            // Play explosion animation instead of revealing votes
            playExplosionAnimation();
        }
    }, 1000);
}

function resetTimerFunction() {
    // Clear any existing interval
    clearInterval(timerInterval);
    
    // Reset timer value and update display
    timerValue = 10;
    timerRunning = false;
    updateTimerDisplay();
    
    // Reset button appearance
    domElements.startTimer.innerHTML = '<i class="fas fa-play"></i>';
    domElements.startTimer.title = 'Start Timer';
    
    // Broadcast timer reset to all participants if user is moderator
    if (currentUser.role === 'scrum-master' || currentUser.role === 'product-owner') {
        socket.emit('timer-reset', { roomId });
    }
}

function updateTimerDisplay() {
    domElements.timerValue.textContent = timerValue;
    
    // Add visual indicators when time is running low
    if (timerValue <= 3) {
        domElements.timerValue.classList.add('timer-danger');
        domElements.timerValue.classList.remove('timer-warning');
    } else if (timerValue <= 5) {
        domElements.timerValue.classList.add('timer-warning');
        domElements.timerValue.classList.remove('timer-danger');
    } else {
        domElements.timerValue.classList.remove('timer-warning', 'timer-danger');
    }
}

// Play explosion animation when timer reaches zero
function playExplosionAnimation() {
    // Add explosion animation class
    domElements.timerValue.classList.add('explosion-animation');
    domElements.timerValue.textContent = '💥';
    
    // Play sound effect (optional)
    // const explosionSound = new Audio('path/to/explosion-sound.mp3');
    // explosionSound.play();
    
    // Reset after animation completes
    setTimeout(() => {
        domElements.timerValue.classList.remove('explosion-animation');
        domElements.timerValue.textContent = '0';
    }, 1500);
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
