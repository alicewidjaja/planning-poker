const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const axios = require('axios');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(session({
    secret: 'planning-poker-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// JIRA API proxy endpoints
app.post('/api/jira/connect', (req, res) => {
    const { url, email, token } = req.body;
    
    if (!url || !email || !token) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // Store credentials in session
    req.session.jiraCredentials = { url, email, token };
    
    // Test connection with better error handling
    const apiUrl = url.endsWith('/') ? `${url}rest/api/2/myself` : `${url}/rest/api/2/myself`;
    
    console.log(`Attempting to connect to JIRA at: ${apiUrl}`);
    
    axios({
        method: 'get',
        url: apiUrl,
        auth: {
            username: email,
            password: token
        },
        timeout: 10000 // 10 second timeout
    })
    .then(response => {
        console.log('JIRA connection successful');
        res.json({ success: true, user: response.data });
    })
    .catch(error => {
        console.error('JIRA connection failed:', error.message);
        
        // More detailed error information
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
            res.status(error.response.status).json({ 
                success: false, 
                error: `Authentication failed: ${error.response.status} ${error.response.statusText}`,
                details: error.response.data
            });
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received:', error.request);
            res.status(500).json({ 
                success: false, 
                error: 'No response from JIRA server. Please check the URL and your network connection.'
            });
        } else {
            // Something happened in setting up the request
            res.status(500).json({ success: false, error: `Request error: ${error.message}` });
        }
    });
});

app.get('/api/jira/issue/:issueKey', (req, res) => {
    if (!req.session || !req.session.jiraCredentials) {
        return res.status(401).json({ error: 'Not authenticated with JIRA' });
    }
    
    const { url, email, token } = req.session.jiraCredentials;
    const issueKey = req.params.issueKey;
    
    axios({
        method: 'get',
        url: `${url}/rest/api/2/issue/${issueKey}`,
        auth: {
            username: email,
            password: token
        }
    })
    .then(response => {
        console.log(`Successfully fetched JIRA issue ${issueKey}`);
        res.json(response.data);
    })
    .catch(error => {
        console.error(`Failed to fetch JIRA issue ${issueKey}:`, error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data || 'Failed to fetch issue' 
        });
    });
});

app.post('/api/jira/update-points/:issueKey', (req, res) => {
    if (!req.session || !req.session.jiraCredentials) {
        return res.status(401).json({ error: 'Not authenticated with JIRA' });
    }
    
    const { url, email, token } = req.session.jiraCredentials;
    const { points, fieldId } = req.body;
    const issueKey = req.params.issueKey;
    
    // Default to customfield_10002 if not specified
    const storyPointsField = fieldId || 'customfield_10002';
    
    axios({
        method: 'put',
        url: `${url}/rest/api/2/issue/${issueKey}`,
        auth: {
            username: email,
            password: token
        },
        data: {
            fields: {
                [storyPointsField]: parseFloat(points)
            }
        }
    })
    .then(() => {
        console.log(`Updated story points for ${issueKey} to ${points}`);
        res.json({ success: true });
    })
    .catch(error => {
        console.error(`Failed to update story points for ${issueKey}:`, error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data || 'Failed to update issue' 
        });
    });
});

app.get('/api/jira/disconnect', (req, res) => {
    if (req.session) {
        delete req.session.jiraCredentials;
    }
    res.json({ success: true });
});

// Store rooms and participants
const rooms = {};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Join room
    socket.on('join-room', (data) => {
        const { roomId, name, role } = data;
        
        // Create room if it doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = {
                participants: [],
                story: null,
                votesRevealed: false
            };
        }
        
        // Add participant to room
        const participant = {
            id: socket.id,
            name,
            role,
            vote: null,
            hasVoted: false
        };
        
        rooms[roomId].participants.push(participant);
        
        // Join socket to room
        socket.join(roomId);
        
        // Store room ID in socket for later use
        socket.roomId = roomId;
        
        // Send current room state to the new participant
        socket.emit('room-joined', {
            participants: rooms[roomId].participants,
            story: rooms[roomId].story,
            votesRevealed: rooms[roomId].votesRevealed
        });
        
        // Notify other participants
        socket.to(roomId).emit('participant-joined', participant);
        
        console.log(`${name} joined room ${roomId}`);
    });
    
    // Submit vote
    socket.on('submit-vote', (data) => {
        const { vote } = data;
        const roomId = socket.roomId;
        
        if (!roomId || !rooms[roomId]) return;
        
        // Update participant's vote
        const participantIndex = rooms[roomId].participants.findIndex(p => p.id === socket.id);
        if (participantIndex !== -1) {
            rooms[roomId].participants[participantIndex].vote = vote;
            rooms[roomId].participants[participantIndex].hasVoted = true;
            
            // Notify all participants in the room
            io.to(roomId).emit('vote-submitted', {
                participantId: socket.id,
                hasVoted: true
            });
            
            console.log(`Participant ${socket.id} voted in room ${roomId}`);
        }
    });
    
    // Reveal votes
    socket.on('reveal-votes', () => {
        const roomId = socket.roomId;
        
        if (!roomId || !rooms[roomId]) return;
        
        // Check if the participant is a moderator
        const participant = rooms[roomId].participants.find(p => p.id === socket.id);
        if (!participant || (participant.role !== 'scrum-master' && participant.role !== 'product-owner')) {
            return;
        }
        
        // Reveal votes
        rooms[roomId].votesRevealed = true;
        
        // Notify all participants in the room
        io.to(roomId).emit('votes-revealed', {
            participants: rooms[roomId].participants
        });
        
        console.log(`Votes revealed in room ${roomId}`);
    });
    
    // Reset voting
    socket.on('reset-voting', () => {
        const roomId = socket.roomId;
        
        if (!roomId || !rooms[roomId]) return;
        
        // Check if the participant is a moderator
        const participant = rooms[roomId].participants.find(p => p.id === socket.id);
        if (!participant || (participant.role !== 'scrum-master' && participant.role !== 'product-owner')) {
            return;
        }
        
        // Reset votes
        rooms[roomId].participants.forEach(p => {
            p.vote = null;
            p.hasVoted = false;
        });
        
        rooms[roomId].votesRevealed = false;
        
        // Notify all participants in the room
        io.to(roomId).emit('voting-reset', {
            participants: rooms[roomId].participants
        });
        
        console.log(`Voting reset in room ${roomId}`);
    });
    
    // Add story
    socket.on('add-story', (data) => {
        const { title, description, link } = data;
        const roomId = socket.roomId;
        
        if (!roomId || !rooms[roomId]) return;
        
        // Update story
        rooms[roomId].story = {
            title,
            description,
            link
        };
        
        // Notify all participants in the room
        io.to(roomId).emit('story-added', rooms[roomId].story);
        
        console.log(`Story added to room ${roomId}`);
    });
    
    // Timer events
    socket.on('timer-start', (data) => {
        const { roomId } = data;
        
        if (!roomId || !rooms[roomId]) return;
        
        // Check if the user is a moderator
        const participant = rooms[roomId].participants.find(p => p.id === socket.id);
        if (!participant || (participant.role !== 'scrum-master' && participant.role !== 'product-owner')) {
            return;
        }
        
        // Broadcast timer start to all participants in the room
        io.to(roomId).emit('timer-started');
        console.log(`Timer started in room ${roomId} by ${participant.name}`);
    });
    
    socket.on('timer-reset', (data) => {
        const { roomId } = data;
        
        if (!roomId || !rooms[roomId]) return;
        
        // Check if the user is a moderator
        const participant = rooms[roomId].participants.find(p => p.id === socket.id);
        if (!participant || (participant.role !== 'scrum-master' && participant.role !== 'product-owner')) {
            return;
        }
        
        // Broadcast timer reset to all participants in the room
        io.to(roomId).emit('timer-reset');
        console.log(`Timer reset in room ${roomId} by ${participant.name}`);
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        
        if (roomId && rooms[roomId]) {
            // Remove participant from room
            const participantIndex = rooms[roomId].participants.findIndex(p => p.id === socket.id);
            
            if (participantIndex !== -1) {
                const participant = rooms[roomId].participants[participantIndex];
                rooms[roomId].participants.splice(participantIndex, 1);
                
                // Notify other participants
                socket.to(roomId).emit('participant-left', {
                    id: socket.id
                });
                
                console.log(`${participant.name} left room ${roomId}`);
                
                // Remove room if empty
                if (rooms[roomId].participants.length === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} removed`);
                }
            }
        }
        
        console.log('Client disconnected:', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;

// Add error handling
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
        server.listen(PORT + 1);
    } else {
        console.error('Server error:', error);
    }
});

process.on('SIGINT', () => {
    console.log('Gracefully shutting down server...');
    server.close(() => {
        console.log('Server shut down successfully');
        process.exit(0);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
