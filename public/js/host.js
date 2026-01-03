// ============================================
// FIBBAGE CLONE - Host Screen JavaScript
// ============================================

class FibbageHost {
    constructor() {
        this.socket = io();
        this.roomCode = null;
        this.players = [];
        this.currentQuestion = null;
        this.answers = [];
        this.myLieId = null;

        this.initializeElements();
        this.bindEvents();
        this.createRoom();
    }

    initializeElements() {
        // Screens
        this.screens = {
            lobby: document.getElementById('lobby-screen'),
            writing: document.getElementById('writing-screen'),
            voting: document.getElementById('voting-screen'),
            results: document.getElementById('results-screen'),
            scoreboard: document.getElementById('scoreboard-screen'),
            gameover: document.getElementById('gameover-screen')
        };

        // Lobby elements
        this.roomCodeDisplay = document.getElementById('room-code');
        this.playerCountDisplay = document.getElementById('player-count');
        this.playersGrid = document.getElementById('players-grid');
        this.startGameBtn = document.getElementById('start-game-btn');

        // Writing elements
        this.currentRoundDisplay = document.getElementById('current-round');
        this.totalRoundsDisplay = document.getElementById('total-rounds');
        this.writingTimer = document.getElementById('writing-timer');
        this.questionCategory = document.getElementById('question-category');
        this.questionText = document.getElementById('question-text');
        this.submissionGrid = document.getElementById('submission-grid');

        // Voting elements
        this.votingTimer = document.getElementById('voting-timer');
        this.votingQuestionText = document.getElementById('voting-question-text');
        this.answersContainer = document.getElementById('answers-container');
        this.votesCount = document.getElementById('votes-count');
        this.votesTotal = document.getElementById('votes-total');

        // Results elements
        this.truthAnswer = document.getElementById('truth-answer');
        this.resultsBreakdown = document.getElementById('results-breakdown');

        // Scoreboard elements
        this.scoreRound = document.getElementById('score-round');
        this.scoreboardContainer = document.getElementById('scoreboard-container');

        // Game over elements
        this.winnerAvatar = document.getElementById('winner-avatar');
        this.winnerName = document.getElementById('winner-name');
        this.winnerScore = document.getElementById('winner-score');
        this.finalScores = document.getElementById('final-scores');
        this.playAgainBtn = document.getElementById('play-again-btn');

        // Audio elements
        this.sounds = {
            join: document.getElementById('sound-join'),
            tick: document.getElementById('sound-tick'),
            submit: document.getElementById('sound-submit'),
            reveal: document.getElementById('sound-reveal'),
            correct: document.getElementById('sound-correct'),
            wrong: document.getElementById('sound-wrong'),
            winner: document.getElementById('sound-winner'),
            music: document.getElementById('sound-music')
        };
    }

    bindEvents() {
        // Socket events
        this.socket.on('playerJoined', (data) => this.onPlayerJoined(data));
        this.socket.on('playerLeft', (data) => this.onPlayerLeft(data));
        this.socket.on('playerSubmitted', (data) => this.onPlayerSubmitted(data));
        this.socket.on('roundStart', (data) => this.onRoundStart(data));
        this.socket.on('votingStart', (data) => this.onVotingStart(data));
        this.socket.on('roundResults', (data) => this.onRoundResults(data));
        this.socket.on('scoreboard', (data) => this.onScoreboard(data));
        this.socket.on('gameOver', (data) => this.onGameOver(data));
        this.socket.on('timerUpdate', (data) => this.onTimerUpdate(data));
        this.socket.on('gameRestarted', (data) => this.onGameRestarted(data));

        // Button events
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.playAgainBtn.addEventListener('click', () => this.restartGame());
    }

    // Sound helpers
    playSound(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {}); // Ignore autoplay errors
        }
    }

    // Screen management
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
        }
    }

    // Create a new game room
    createRoom() {
        this.socket.emit('createRoom', (response) => {
            if (response.success) {
                this.roomCode = response.roomCode;
                this.roomCodeDisplay.textContent = this.roomCode;
                console.log('Room created:', this.roomCode);
            } else {
                console.error('Failed to create room:', response.error);
            }
        });
    }

    // Start the game
    startGame() {
        if (this.players.length >= 2) {
            this.socket.emit('startGame', { roomCode: this.roomCode });
        }
    }

    // Restart the game
    restartGame() {
        this.socket.emit('restartGame', { roomCode: this.roomCode });
    }

    // Update players display
    updatePlayersDisplay() {
        this.playerCountDisplay.textContent = this.players.length;

        if (this.players.length === 0) {
            this.playersGrid.innerHTML = '<div class="empty-slot">Waiting for players...</div>';
        } else {
            this.playersGrid.innerHTML = this.players.map(player => `
                <div class="player-card">
                    <span class="avatar">${player.avatar}</span>
                    <span class="name">${this.escapeHtml(player.name)}</span>
                </div>
            `).join('');
        }

        // Update start button
        if (this.players.length >= 2) {
            this.startGameBtn.disabled = false;
            this.startGameBtn.textContent = 'Start Game!';
        } else {
            this.startGameBtn.disabled = true;
            this.startGameBtn.textContent = `Need ${2 - this.players.length} more player${this.players.length === 1 ? '' : 's'}`;
        }
    }

    // Update submission grid
    updateSubmissionGrid(submittedPlayerIds = []) {
        this.submissionGrid.innerHTML = this.players.map(player => {
            const isSubmitted = submittedPlayerIds.includes(player.id);
            return `
                <div class="submission-item ${isSubmitted ? 'submitted' : ''}">
                    <span class="avatar">${player.avatar}</span>
                    <span class="name">${this.escapeHtml(player.name)}</span>
                    <span class="status-icon">${isSubmitted ? '✓' : '○'}</span>
                </div>
            `;
        }).join('');
    }

    // Socket event handlers
    onPlayerJoined(data) {
        this.players = data.players;
        this.updatePlayersDisplay();
        this.playSound('join');
    }

    onPlayerLeft(data) {
        this.players = data.players;
        this.updatePlayersDisplay();
    }

    onPlayerSubmitted(data) {
        this.playSound('submit');

        if (data.type === 'lie') {
            // Find all submitted player IDs
            const submittedCount = data.count;
            // We don't have the full list, so just update the count display
            // The submission grid will be refreshed with proper data from server
        } else if (data.type === 'vote') {
            this.votesCount.textContent = data.count;
        }
    }

    onRoundStart(data) {
        this.showScreen('writing');

        this.currentRoundDisplay.textContent = data.round;
        this.totalRoundsDisplay.textContent = data.totalRounds;
        this.questionCategory.textContent = data.category;
        this.questionText.textContent = data.question;
        this.writingTimer.textContent = data.timeLimit;

        this.updateSubmissionGrid([]);
    }

    onVotingStart(data) {
        this.showScreen('voting');

        this.votingQuestionText.textContent = data.question;
        this.votingTimer.textContent = data.timeLimit;
        this.answers = data.answers;

        // Display answers
        this.answersContainer.innerHTML = data.answers.map((answer, index) => `
            <div class="answer-card" style="animation-delay: ${0.1 * index}s">
                ${this.escapeHtml(answer.text)}
            </div>
        `).join('');

        this.votesCount.textContent = '0';
        this.votesTotal.textContent = this.players.length;
    }

    onRoundResults(data) {
        this.showScreen('results');
        this.playSound('reveal');

        this.truthAnswer.textContent = data.correctAnswer;

        // Build results breakdown
        let resultsHtml = '';

        // Show the truth card first
        resultsHtml += `
            <div class="result-card truth">
                <div class="result-label">THE TRUTH</div>
                <div class="result-answer">${this.escapeHtml(data.correctAnswer)}</div>
                <div class="result-voters">
                    ${data.playerResults
                        .filter(p => p.votedCorrectly)
                        .map(p => `<span class="voter-chip correct">${p.avatar} ${this.escapeHtml(p.name)} +1000</span>`)
                        .join('')}
                </div>
            </div>
        `;

        // Show each lie
        data.lieResults.forEach(lie => {
            if (!lie.text) return;

            resultsHtml += `
                <div class="result-card lie">
                    <div class="result-label">LIE</div>
                    <div class="result-answer">${this.escapeHtml(lie.text)}</div>
                    <div class="result-author">
                        <span class="avatar">${data.playerResults.find(p => p.id === lie.authorId)?.avatar || '😀'}</span>
                        <span>Written by ${this.escapeHtml(lie.authorName)}</span>
                    </div>
                    ${lie.fooledCount > 0 ? `
                        <div class="result-voters">
                            ${lie.fooledNames.map(name => `<span class="voter-chip fooled">Fooled ${this.escapeHtml(name)}</span>`).join('')}
                        </div>
                        <div class="points-earned">+${lie.fooledCount * 500} points!</div>
                    ` : '<div class="points-earned" style="color: var(--text-muted)">Fooled nobody</div>'}
                </div>
            `;
        });

        this.resultsBreakdown.innerHTML = resultsHtml;
    }

    onScoreboard(data) {
        this.showScreen('scoreboard');

        this.scoreRound.textContent = data.round;

        this.scoreboardContainer.innerHTML = data.scores.map((player, index) => `
            <div class="score-row" style="--index: ${index}; animation-delay: ${0.1 * index}s">
                <div class="score-position">#${index + 1}</div>
                <div class="score-player">
                    <span class="avatar">${player.avatar}</span>
                    <span class="name">${this.escapeHtml(player.name)}</span>
                </div>
                <div class="score-value">${player.score.toLocaleString()}</div>
            </div>
        `).join('');
    }

    onGameOver(data) {
        this.showScreen('gameover');
        this.playSound('winner');

        this.winnerAvatar.textContent = data.winner.avatar;
        this.winnerName.textContent = data.winner.name;
        this.winnerScore.textContent = `${data.winner.score.toLocaleString()} pts`;

        // Show all scores except winner
        this.finalScores.innerHTML = data.scores.slice(1).map((player, index) => `
            <div class="final-score-row">
                <span class="position">#${index + 2}</span>
                <span class="player-info">
                    <span class="avatar">${player.avatar}</span>
                    <span>${this.escapeHtml(player.name)}</span>
                </span>
                <span class="score">${player.score.toLocaleString()}</span>
            </div>
        `).join('');
    }

    onTimerUpdate(data) {
        const time = data.time;

        // Update visible timer
        const writingScreen = this.screens.writing;
        const votingScreen = this.screens.voting;

        if (writingScreen.classList.contains('active')) {
            this.writingTimer.textContent = time;
            this.updateTimerClass(this.writingTimer, time);
        } else if (votingScreen.classList.contains('active')) {
            this.votingTimer.textContent = time;
            this.updateTimerClass(this.votingTimer, time);
        }

        // Play tick sound in last 5 seconds
        if (time <= 5 && time > 0) {
            this.playSound('tick');
        }
    }

    updateTimerClass(element, time) {
        element.classList.remove('warning', 'danger');
        if (time <= 5) {
            element.classList.add('danger');
        } else if (time <= 10) {
            element.classList.add('warning');
        }
    }

    onGameRestarted(data) {
        this.players = data.players;
        this.showScreen('lobby');
        this.updatePlayersDisplay();
    }

    // Utility: Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fibbageHost = new FibbageHost();
});
