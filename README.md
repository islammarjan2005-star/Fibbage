# Fibbage Clone

A web-based multiplayer party game inspired by Fibbage from Jackbox Games. Players write convincing lies to fool each other while trying to find the truth!

## How to Play

1. **Host a Game**: One person opens the game on a TV/monitor and creates a room
2. **Join the Room**: Other players join using their phones by entering the room code
3. **Write Lies**: Each round shows a trivia question with a blank - players write convincing fake answers
4. **Find the Truth**: All answers (lies + the real answer) are shown - pick what you think is true
5. **Score Points**:
   - +1000 points for finding the truth
   - +500 points for each player you fool with your lie

## Features

- Real-time multiplayer using Socket.io
- 2-8 players supported
- 100 trivia questions with blanks
- 5 rounds per game
- Mobile-friendly player interface
- Animated host screen for TV display
- Score tracking and leaderboards

## Installation

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The game will be available at `http://localhost:3000`

## Playing

1. Open `http://localhost:3000` on a computer connected to a TV
2. Click "Host a Game"
3. Share the room code with players
4. Players go to `http://[your-ip]:3000/play` on their phones
5. Enter the room code and a name to join
6. Start the game when everyone has joined!

## Tech Stack

- Node.js + Express
- Socket.io for real-time communication
- Vanilla JavaScript (no frontend framework)
- CSS3 with animations

## Project Structure

```
├── server.js           # Main server with game logic
├── questions.json      # Trivia questions database
├── package.json
└── public/
    ├── index.html      # Landing page
    ├── host.html       # Host/TV screen
    ├── play.html       # Player/mobile screen
    ├── css/
    │   ├── style.css   # Shared styles
    │   ├── host.css    # Host screen styles
    │   └── player.css  # Player screen styles
    ├── js/
    │   ├── host.js     # Host screen logic
    │   └── player.js   # Player screen logic
    └── sounds/         # Sound effects (placeholders)
```

## Credits

Inspired by Fibbage by Jackbox Games. This is a tribute/clone for educational purposes.

## License

MIT
