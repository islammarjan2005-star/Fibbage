const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game rooms storage
const rooms = new Map();

// Trivia questions with blanks
const questions = require('./questions.json');

// Generate a unique room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Get random questions for a game
function getRandomQuestions(count) {
  const shuffled = shuffleArray(questions);
  return shuffled.slice(0, count);
}

// Create a new room
function createRoom(hostSocketId) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const room = {
    code,
    hostSocketId,
    players: [],
    gameState: 'lobby', // lobby, writing, voting, results, scores, gameover
    currentRound: 0,
    totalRounds: 5,
    questions: [],
    currentQuestion: null,
    lies: new Map(),
    votes: new Map(),
    timer: null,
    timerValue: 0,
    settings: {
      maxPlayers: 8,
      timeToWrite: 60,
      timeToVote: 30
    }
  };

  rooms.set(code, room);
  return room;
}

// Calculate scores for a round
function calculateRoundScores(room) {
  const results = {
    correctAnswer: room.currentQuestion.answer,
    playerResults: [],
    lieResults: []
  };

  const correctVoters = [];
  const fooledPlayers = new Map(); // playerId -> [fooled player names]

  // Process each vote
  room.votes.forEach((votedFor, voterId) => {
    const voter = room.players.find(p => p.id === voterId);
    if (!voter) return;

    if (votedFor === 'truth') {
      // Voted for the correct answer
      voter.score += 1000;
      voter.roundScore = (voter.roundScore || 0) + 1000;
      correctVoters.push(voter.name);
    } else {
      // Voted for a lie
      const lieOwner = room.players.find(p => p.id === votedFor);
      if (lieOwner) {
        lieOwner.score += 500;
        lieOwner.roundScore = (lieOwner.roundScore || 0) + 500;
        if (!fooledPlayers.has(votedFor)) {
          fooledPlayers.set(votedFor, []);
        }
        fooledPlayers.get(votedFor).push(voter.name);
      }
    }
  });

  // Compile results for each player
  room.players.forEach(player => {
    const lie = room.lies.get(player.id);
    const fooledBy = fooledPlayers.get(player.id) || [];

    results.playerResults.push({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      lie: lie,
      fooledPlayers: fooledBy,
      votedCorrectly: correctVoters.includes(player.name),
      roundScore: player.roundScore || 0,
      totalScore: player.score
    });

    if (lie) {
      results.lieResults.push({
        text: lie,
        authorId: player.id,
        authorName: player.name,
        fooledCount: fooledBy.length,
        fooledNames: fooledBy
      });
    }
  });

  // Sort by round score
  results.playerResults.sort((a, b) => b.roundScore - a.roundScore);

  return results;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Host creates a new game
  socket.on('createRoom', (callback) => {
    const room = createRoom(socket.id);
    socket.join(room.code);
    console.log(`Room ${room.code} created by ${socket.id}`);
    callback({ success: true, roomCode: room.code });
  });

  // Player joins a room
  socket.on('joinRoom', ({ roomCode, playerName, avatar }, callback) => {
    const room = rooms.get(roomCode.toUpperCase());

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.gameState !== 'lobby') {
      callback({ success: false, error: 'Game already in progress' });
      return;
    }

    if (room.players.length >= room.settings.maxPlayers) {
      callback({ success: false, error: 'Room is full' });
      return;
    }

    // Check for duplicate names
    if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      callback({ success: false, error: 'Name already taken' });
      return;
    }

    const player = {
      id: socket.id,
      name: playerName,
      avatar: avatar || '😀',
      score: 0,
      roundScore: 0,
      isReady: false
    };

    room.players.push(player);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    // Notify host about new player
    io.to(room.hostSocketId).emit('playerJoined', { players: room.players });

    // Notify all players in room
    socket.to(roomCode).emit('playerListUpdated', { players: room.players });

    callback({ success: true, playerId: socket.id, players: room.players });
  });

  // Host starts the game
  socket.on('startGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }

    // Initialize game
    room.questions = getRandomQuestions(room.totalRounds);
    room.currentRound = 0;
    room.gameState = 'writing';

    // Reset all player scores
    room.players.forEach(p => {
      p.score = 0;
      p.roundScore = 0;
    });

    startNewRound(room);
  });

  // Start a new round
  function startNewRound(room) {
    room.currentRound++;
    room.lies.clear();
    room.votes.clear();
    room.currentQuestion = room.questions[room.currentRound - 1];
    room.gameState = 'writing';

    // Reset round scores
    room.players.forEach(p => p.roundScore = 0);

    // Notify everyone about new round
    io.to(room.code).emit('roundStart', {
      round: room.currentRound,
      totalRounds: room.totalRounds,
      question: room.currentQuestion.question,
      category: room.currentQuestion.category,
      timeLimit: room.settings.timeToWrite
    });

    // Start timer
    startTimer(room, room.settings.timeToWrite, () => {
      // Auto-submit empty lies for players who didn't submit
      room.players.forEach(player => {
        if (!room.lies.has(player.id)) {
          room.lies.set(player.id, '');
        }
      });
      startVoting(room);
    });
  }

  // Start voting phase
  function startVoting(room) {
    room.gameState = 'voting';

    // Compile all answers (lies + truth)
    const answers = [];

    // Add all lies
    room.lies.forEach((lie, playerId) => {
      if (lie && lie.trim()) {
        answers.push({
          id: playerId,
          text: lie,
          isLie: true
        });
      }
    });

    // Add the truth
    answers.push({
      id: 'truth',
      text: room.currentQuestion.answer,
      isLie: false
    });

    // Shuffle answers
    const shuffledAnswers = shuffleArray(answers);

    io.to(room.code).emit('votingStart', {
      question: room.currentQuestion.question,
      answers: shuffledAnswers.map(a => ({ id: a.id, text: a.text })),
      timeLimit: room.settings.timeToVote
    });

    // Send each player their excluded answer (their own lie)
    room.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('yourLieId', { lieId: player.id });
      }
    });

    // Start timer
    startTimer(room, room.settings.timeToVote, () => {
      showResults(room);
    });
  }

  // Show results
  function showResults(room) {
    room.gameState = 'results';
    clearTimer(room);

    const results = calculateRoundScores(room);

    io.to(room.code).emit('roundResults', results);

    // After showing results, wait then either start next round or end game
    setTimeout(() => {
      if (room.currentRound >= room.totalRounds) {
        endGame(room);
      } else {
        showScoreboard(room);
      }
    }, 8000);
  }

  // Show scoreboard between rounds
  function showScoreboard(room) {
    room.gameState = 'scores';

    const scoreboard = room.players
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score
      }))
      .sort((a, b) => b.score - a.score);

    io.to(room.code).emit('scoreboard', {
      scores: scoreboard,
      round: room.currentRound,
      totalRounds: room.totalRounds
    });

    // After showing scoreboard, start next round
    setTimeout(() => {
      startNewRound(room);
    }, 5000);
  }

  // End the game
  function endGame(room) {
    room.gameState = 'gameover';
    clearTimer(room);

    const finalScores = room.players
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score
      }))
      .sort((a, b) => b.score - a.score);

    io.to(room.code).emit('gameOver', {
      winner: finalScores[0],
      scores: finalScores
    });
  }

  // Timer functions
  function startTimer(room, seconds, callback) {
    clearTimer(room);
    room.timerValue = seconds;

    room.timer = setInterval(() => {
      room.timerValue--;
      io.to(room.code).emit('timerUpdate', { time: room.timerValue });

      if (room.timerValue <= 0) {
        clearTimer(room);
        callback();
      }
    }, 1000);
  }

  function clearTimer(room) {
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }
  }

  // Player submits a lie
  socket.on('submitLie', ({ roomCode, lie }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'writing') return;

    // Check if lie matches the truth (case insensitive)
    const normalizedLie = lie.toLowerCase().trim();
    const normalizedTruth = room.currentQuestion.answer.toLowerCase().trim();

    if (normalizedLie === normalizedTruth) {
      socket.emit('lieRejected', { reason: 'Your lie is too close to the truth!' });
      return;
    }

    // Check if lie matches another player's lie
    for (const [playerId, existingLie] of room.lies) {
      if (existingLie.toLowerCase().trim() === normalizedLie) {
        socket.emit('lieRejected', { reason: 'Someone else already submitted this lie!' });
        return;
      }
    }

    room.lies.set(socket.id, lie);
    socket.emit('lieAccepted');

    // Notify host about submission
    io.to(room.hostSocketId).emit('playerSubmitted', {
      playerId: socket.id,
      type: 'lie',
      count: room.lies.size,
      total: room.players.length
    });

    // Check if all players have submitted
    if (room.lies.size === room.players.length) {
      clearTimer(room);
      startVoting(room);
    }
  });

  // Player submits a vote
  socket.on('submitVote', ({ roomCode, answerId }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'voting') return;

    // Can't vote for own lie
    if (answerId === socket.id) {
      socket.emit('voteRejected', { reason: "You can't vote for your own lie!" });
      return;
    }

    room.votes.set(socket.id, answerId);
    socket.emit('voteAccepted');

    // Notify host about vote
    io.to(room.hostSocketId).emit('playerSubmitted', {
      playerId: socket.id,
      type: 'vote',
      count: room.votes.size,
      total: room.players.length
    });

    // Check if all players have voted
    if (room.votes.size === room.players.length) {
      clearTimer(room);
      showResults(room);
    }
  });

  // Host requests to continue to next round
  socket.on('continueGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    if (room.gameState === 'results') {
      if (room.currentRound >= room.totalRounds) {
        endGame(room);
      } else {
        showScoreboard(room);
      }
    } else if (room.gameState === 'scores') {
      startNewRound(room);
    }
  });

  // Host restarts the game
  socket.on('restartGame', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    room.gameState = 'lobby';
    room.currentRound = 0;
    room.questions = [];
    room.currentQuestion = null;
    room.lies.clear();
    room.votes.clear();
    clearTimer(room);

    room.players.forEach(p => {
      p.score = 0;
      p.roundScore = 0;
    });

    io.to(room.code).emit('gameRestarted', { players: room.players });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Check if this was a host
    for (const [code, room] of rooms) {
      if (room.hostSocketId === socket.id) {
        // Host disconnected - end the room
        io.to(code).emit('hostDisconnected');
        clearTimer(room);
        rooms.delete(code);
        return;
      }

      // Check if this was a player
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        // Notify everyone
        io.to(room.hostSocketId).emit('playerLeft', {
          player,
          players: room.players
        });
        io.to(code).emit('playerListUpdated', { players: room.players });

        // If game is in progress and not enough players, end the game
        if (room.gameState !== 'lobby' && room.players.length < 2) {
          io.to(code).emit('notEnoughPlayers');
          room.gameState = 'lobby';
          clearTimer(room);
        }
        return;
      }
    }
  });

  // Get room info
  socket.on('getRoomInfo', ({ roomCode }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    callback({
      success: true,
      players: room.players,
      gameState: room.gameState,
      isHost: room.hostSocketId === socket.id
    });
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Fibbage Clone server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to start playing!`);
});
