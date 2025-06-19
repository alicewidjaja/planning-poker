# Agile Planning Poker

A real-time web application for agile teams to estimate user stories using the planning poker technique. This application supports up to 20 participants and includes JIRA integration.

## Features

- Support for up to 20 participants
- Standard agile story point values (1, 2, 3, 5, 8, 13, 21, ?)
- Role-based access (Scrum Master, Product Owner, Team Member, Observer)
- Vote revealing controlled by Scrum Master or Product Owner
- JIRA integration for viewing tickets directly
- Statistical analysis of votes (average, median, mode)
- Real-time updates using WebSockets
- Responsive design for desktop and mobile devices

## How to Use

### Starting a Session

1. Open `index.html` in your web browser
2. A new room will be automatically created with a unique ID
3. Copy the room link and share it with your team members
4. Enter your name and select your role
5. Click "Join Session"

### Adding User Stories

You can add user stories in two ways:

1. **JIRA Integration**:
   - Enter your JIRA credentials
   - Click "Connect"
   - Enter a JIRA issue ID
   - Click "Load Issue"

2. **Manual Entry**:
   - Click "Add Story Manually"
   - Enter the story title and description
   - Click "Add Story"

### Voting

1. Review the current user story
2. Select a card with your estimate
3. Wait for all team members to vote
4. The Scrum Master or Product Owner can reveal all votes simultaneously
5. Review the voting statistics
6. Reset voting for the next story

## JIRA Integration

To use the JIRA integration:

1. You'll need your JIRA URL (e.g., https://your-domain.atlassian.net)
2. Your JIRA email address
3. An API token (can be generated in your Atlassian account settings)

## Technical Details

This application uses:

- HTML5, CSS3, and JavaScript
- WebSockets for real-time communication (simulated in this demo)
- Responsive design for all device sizes

## Local Development

This application uses Node.js with Express and Socket.IO for real-time communication. To run it locally:

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open `http://localhost:3000` in your browser.

## How Multiple Team Members Join the Same Session

1. The first team member creates a new room by opening the application.
2. The application automatically generates a unique room ID that appears in the URL (e.g., `http://localhost:3000?room=abc123`).
3. The first team member clicks the "Copy Room Link" button and shares this link with other team members.
4. Other team members open the shared link in their browsers, which connects them to the same room.
5. Each team member enters their name and selects their role, then clicks "Join Session".
6. All participants will see each other in the participants list in real-time.
7. When participants vote, others will see their voting status update (but not their actual vote until revealed).
8. Only the Scrum Master or Product Owner can reveal votes and reset voting for the next story.

The application supports up to 20 participants in a single room, all interacting in real-time.

## Future Enhancements

- Persistent storage for session history
- Enhanced JIRA integration with two-way updates
- Custom card values
- Timer functionality
- Export of estimation results
