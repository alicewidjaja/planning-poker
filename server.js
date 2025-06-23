const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files
app.use(express.static(path.join(__dirname)));

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
