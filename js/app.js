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
let timerInterval;
let timerValue = 5;
let defaultTimerValue = 5;
let timerRunning = false;

// DOM Elements
const domElements = {
    roomId: document.getElementById('room-id'),
    copyRoomLink: document.getElementById('copy-room-link'),
    createNewRoom: document.getElementById('create-new-room'),
    themeToggle: document.getElementById('theme-toggle'),
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
    
    // Theme toggle
    domElements.themeToggle.addEventListener('click', toggleDarkMode);
    
    // Load saved theme preference
    loadThemePreference();
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
    
    socket.on('timer-reset', (data) => {
        if (!data || data.roomId === roomId) {
            resetTimerFunction();
        }
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
    
    // Show loading state
    domElements.jiraConnect.textContent = 'Connecting...';
    domElements.jiraConnect.disabled = true;
    
    // Connect to JIRA via our proxy endpoint
    fetch('/api/jira/connect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: url,
            email: email,
            token: token
        })
    })
    .then(response => response.json())
    .then(data => {
        // Reset button state
        domElements.jiraConnect.textContent = 'Connect';
        domElements.jiraConnect.disabled = false;
        
        if (data.success) {
            // Store JIRA connection info
            jiraConnection = {
                connected: true,
                url: url,
                email: email,
                token: token
            };
            
            // Update UI
            domElements.jiraLoginSection.classList.add('hidden');
            domElements.jiraConnectedSection.classList.remove('hidden');
        } else {
            alert('Failed to connect to JIRA: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error connecting to JIRA:', error);
        domElements.jiraConnect.textContent = 'Connect';
        domElements.jiraConnect.disabled = false;
        alert('Failed to connect to JIRA. Please check your credentials and try again.');
    });
}

// Load JIRA issue
function loadJiraIssue() {
    const issueKey = domElements.jiraIssue.value.trim();
    
    if (!issueKey) {
        alert('Please enter a JIRA issue key (e.g., PROJECT-123)');
        return;
    }
    
    // Show loading state
    domElements.loadIssue.textContent = 'Loading...';
    domElements.loadIssue.disabled = true;
    
    // Fetch the issue from the JIRA API via our proxy
    fetch(`/api/jira/issue/${issueKey}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Reset button state
            domElements.loadIssue.textContent = 'Load';
            domElements.loadIssue.disabled = false;
            
            // Extract relevant information from the JIRA issue
            const issue = {
                id: data.key,
                title: data.fields.summary,
                description: data.fields.description || 'No description provided',
                link: `${jiraConnection.url}/browse/${data.key}`
            };
            
            // Update the current story
            currentStory = issue;
            
            // Display the story
            displayStory();
            
            // Broadcast the story to all participants
            socket.emit('add-story', {
                roomId: roomId,
                story: currentStory
            });
        })
        .catch(error => {
            console.error('Error loading JIRA issue:', error);
            domElements.loadIssue.textContent = 'Load';
            domElements.loadIssue.disabled = false;
            alert('Failed to load JIRA issue. Please check the issue key and try again.');
        });
}

// Disconnect from JIRA
function disconnectJira() {
    // Show loading state
    domElements.disconnectJira.textContent = 'Disconnecting...';
    domElements.disconnectJira.disabled = true;
    
    // Call the disconnect endpoint
    fetch('/api/jira/disconnect')
        .then(response => response.json())
        .then(() => {
            // Reset connection state
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
        })
        .catch(error => {
            console.error('Error disconnecting from JIRA:', error);
        })
        .finally(() => {
            // Reset button state
            domElements.disconnectJira.textContent = 'Disconnect';
            domElements.disconnectJira.disabled = false;
        });
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
        
        // Check if this participant is the current user
        if (participant.id === currentUser.id) {
            li.classList.add('current-user');
        }
        
        li.innerHTML = `
            <span>
                <span class="participant-status ${statusClass}"></span>
                <span class="participant-name">${participant.name}</span>
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
    
    // Group participants by vote
    const voteGroups = {};
    
    participants.forEach(participant => {
        if (participant.role !== 'observer' && participant.hasVoted) {
            if (!voteGroups[participant.vote]) {
                voteGroups[participant.vote] = [];
            }
            voteGroups[participant.vote].push(participant);
        }
    });
    
    // Assign highlight classes to different vote values
    // We'll use up to 6 different highlight styles
    const uniqueVoteValues = Object.keys(voteGroups).filter(vote => vote !== '?');
    const highlightMap = {};
    
    // Assign highlight classes only to values that appear more than once
    let highlightIndex = 1;
    uniqueVoteValues.forEach(voteValue => {
        if (voteGroups[voteValue].length > 1 && highlightIndex <= 6) {
            highlightMap[voteValue] = `highlight-${highlightIndex}`;
            highlightIndex++;
        }
    });
    
    // Display vote cards grouped by vote value
    Object.keys(voteGroups).sort((a, b) => {
        // Sort numerically, but keep '?' at the end
        if (a === '?') return 1;
        if (b === '?') return -1;
        return parseInt(a) - parseInt(b);
    }).forEach(voteValue => {
        voteGroups[voteValue].forEach(participant => {
            const voteCard = document.createElement('div');
            voteCard.className = 'vote-card';
            
            // Determine if this vote value should be highlighted
            const highlightClass = highlightMap[voteValue] || '';
            
            voteCard.innerHTML = `
                <div class="vote-card-value ${highlightClass}">${participant.vote}</div>
                <div class="vote-card-name">${participant.name}</div>
            `;
            domElements.voteCardsContainer.appendChild(voteCard);
        });
    });
    
    // Calculate statistics
    calculateAndDisplayStatistics();
}

// Calculate and display voting statistics
function calculateAndDisplayStatistics() {
    // Get all numeric votes
    const numericVotes = participants
        .filter(p => p.role !== 'observer' && p.hasVoted && !isNaN(parseInt(p.vote)))
        .map(p => parseInt(p.vote));
    
    if (numericVotes.length === 0) {
        domElements.averageVote.textContent = 'N/A';
        domElements.medianVote.textContent = 'N/A';
        domElements.modeVote.textContent = 'N/A';
        return;
    }
    
    // Calculate average
    const sum = numericVotes.reduce((a, b) => a + b, 0);
    const average = sum / numericVotes.length;
    domElements.averageVote.textContent = average.toFixed(1);
    
    // Calculate median
    const sortedVotes = [...numericVotes].sort((a, b) => a - b);
    const middle = Math.floor(sortedVotes.length / 2);
    const median = sortedVotes.length % 2 === 0
        ? (sortedVotes[middle - 1] + sortedVotes[middle]) / 2
        : sortedVotes[middle];
    domElements.medianVote.textContent = median;
    
    // Calculate mode
    const voteCounts = {};
    numericVotes.forEach(vote => {
        voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });
    
    let mode = null;
    let maxCount = 0;
    
    for (const vote in voteCounts) {
        if (voteCounts[vote] > maxCount) {
            maxCount = voteCounts[vote];
            mode = vote;
        }
    }
    
    domElements.modeVote.textContent = mode;
    
    // If we have a JIRA issue and a consensus (mode), show the update button
    if (jiraConnection.connected && currentStory && currentStory.id && mode) {
        // Add update button if it doesn't exist
        if (!document.getElementById('update-jira-points')) {
            const updateButton = document.createElement('button');
            updateButton.id = 'update-jira-points';
            updateButton.textContent = 'Update JIRA Story Points';
            updateButton.classList.add('primary-button');
            updateButton.addEventListener('click', () => updateJiraStoryPoints(currentStory.id, mode));
            
            // Add button after the statistics
            document.getElementById('vote-summary').appendChild(updateButton);
        }
    }
}

// Update JIRA story points
function updateJiraStoryPoints(issueKey, points) {
    if (!jiraConnection.connected || !issueKey || !points) {
        alert('Cannot update story points: missing required information');
        return;
    }
    
    const updateButton = document.getElementById('update-jira-points');
    if (updateButton) {
        updateButton.textContent = 'Updating...';
        updateButton.disabled = true;
    }
    
    // Call the API to update story points
    fetch(`/api/jira/update-points/${issueKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            points: points,
            // You can specify a custom field ID if needed
            fieldId: 'customfield_10002' // This might need to be configured per JIRA instance
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert(`Successfully updated story points for ${issueKey} to ${points}`);
        } else {
            alert(`Failed to update story points: ${data.error || 'Unknown error'}`);
        }
    })
    .catch(error => {
        console.error('Error updating story points:', error);
        alert('Failed to update story points. Please check the console for details.');
    })
    .finally(() => {
        if (updateButton) {
            updateButton.textContent = 'Update JIRA Story Points';
            updateButton.disabled = false;
        }
    });
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
    
    // Reset timer value to 5 seconds
    timerValue = 5;
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
    timerValue = 5;
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

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    
    // Save preference to localStorage
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
}

// Load theme preference from localStorage
function loadThemePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
