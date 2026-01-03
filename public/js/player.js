// ============================================
// FIBBAGE CLONE - Player Screen JavaScript
// ============================================

class FibbagePlayer {
    constructor() {
        this.socket = io();
        this.roomCode = null;
        this.playerId = null;
        this.playerName = null;
        this.playerAvatar = '😀';
        this.myLieId = null;
        this.currentRound = 0;
        this.totalScore = 0;

        this.initializeElements();
        this.bindEvents();
        this.loadSavedData();
    }

    initializeElements() {
        // Screens
        this.screens = {
            join: document.getElementById('join-screen'),
            waiting: document.getElementById('waiting-screen'),
            writingLie: document.getElementById('writing-lie-screen'),
            votingChoices: document.getElementById('voting-choices-screen'),
            resultsWaiting: document.getElementById('results-waiting-screen'),
            scoreUpdate: document.getElementById('score-update-screen'),
            gameover: document.getElementById('player-gameover-screen'),
            disconnected: document.getElementById('disconnected-screen')
        };

        // Join elements
        this.roomCodeInput = document.getElementById('room-code-input');
        this.playerNameInput = document.getElementById('player-name-input');
        this.avatarPicker = document.getElementById('avatar-picker');
        this.joinBtn = document.getElementById('join-btn');
        this.joinError = document.getElementById('join-error');

        // Waiting elements
        this.myAvatarDisplay = document.getElementById('my-avatar');
        this.myNameDisplay = document.getElementById('my-name');
        this.lobbyPlayersList = document.getElementById('lobby-players-list');

        // Writing lie elements
        this.writingRound = document.getElementById('writing-round');
        this.playerWritingTimer = document.getElementById('player-writing-timer');
        this.playerCategory = document.getElementById('player-category');
        this.playerQuestion = document.getElementById('player-question');
        this.lieInput = document.getElementById('lie-input');
        this.charCount = document.getElementById('char-count');
        this.submitLieBtn = document.getElementById('submit-lie-btn');
        this.lieSubmitted = document.getElementById('lie-submitted');
        this.lieError = document.getElementById('lie-error');

        // Voting elements
        this.playerVotingTimer = document.getElementById('player-voting-timer');
        this.votingQuestion = document.getElementById('voting-question');
        this.choicesContainer = document.getElementById('choices-container');
        this.voteSubmitted = document.getElementById('vote-submitted');
        this.voteError = document.getElementById('vote-error');

        // Score elements
        this.scoreAvatar = document.getElementById('score-avatar');
        this.scoreChange = document.getElementById('score-change');
        this.totalScoreDisplay = document.getElementById('total-score');
        this.scoreDetails = document.getElementById('score-details');

        // Game over elements
        this.finalPosition = document.getElementById('final-position');
        this.finalScoreValue = document.getElementById('final-score-value');

        // Disconnected elements
        this.disconnectReason = document.getElementById('disconnect-reason');
    }

    bindEvents() {
        // Socket events
        this.socket.on('playerListUpdated', (data) => this.onPlayerListUpdated(data));
        this.socket.on('roundStart', (data) => this.onRoundStart(data));
        this.socket.on('yourLieId', (data) => this.onYourLieId(data));
        this.socket.on('votingStart', (data) => this.onVotingStart(data));
        this.socket.on('roundResults', (data) => this.onRoundResults(data));
        this.socket.on('scoreboard', (data) => this.onScoreboard(data));
        this.socket.on('gameOver', (data) => this.onGameOver(data));
        this.socket.on('timerUpdate', (data) => this.onTimerUpdate(data));
        this.socket.on('lieAccepted', () => this.onLieAccepted());
        this.socket.on('lieRejected', (data) => this.onLieRejected(data));
        this.socket.on('voteAccepted', () => this.onVoteAccepted());
        this.socket.on('voteRejected', (data) => this.onVoteRejected(data));
        this.socket.on('hostDisconnected', () => this.onHostDisconnected());
        this.socket.on('notEnoughPlayers', () => this.onNotEnoughPlayers());
        this.socket.on('gameRestarted', (data) => this.onGameRestarted(data));

        // UI events
        this.joinBtn.addEventListener('click', () => this.joinGame());
        this.roomCodeInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.playerNameInput.focus();
        });
        this.playerNameInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });

        // Avatar picker
        this.avatarPicker.addEventListener('click', (e) => {
            if (e.target.classList.contains('avatar-btn')) {
                this.avatarPicker.querySelectorAll('.avatar-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                e.target.classList.add('selected');
                this.playerAvatar = e.target.dataset.avatar;
            }
        });

        // Lie input
        this.lieInput.addEventListener('input', () => {
            this.charCount.textContent = this.lieInput.value.length;
        });
        this.submitLieBtn.addEventListener('click', () => this.submitLie());

        // Auto-uppercase room code
        this.roomCodeInput.addEventListener('input', () => {
            this.roomCodeInput.value = this.roomCodeInput.value.toUpperCase();
        });
    }

    loadSavedData() {
        // Try to load saved player name
        const savedName = localStorage.getItem('fibbage_playerName');
        if (savedName) {
            this.playerNameInput.value = savedName;
        }

        const savedAvatar = localStorage.getItem('fibbage_playerAvatar');
        if (savedAvatar) {
            this.playerAvatar = savedAvatar;
            this.avatarPicker.querySelectorAll('.avatar-btn').forEach(btn => {
                btn.classList.remove('selected');
                if (btn.dataset.avatar === savedAvatar) {
                    btn.classList.add('selected');
                }
            });
        }

        // Check URL for room code
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        if (roomCode) {
            this.roomCodeInput.value = roomCode.toUpperCase();
        }
    }

    savePlayerData() {
        localStorage.setItem('fibbage_playerName', this.playerName);
        localStorage.setItem('fibbage_playerAvatar', this.playerAvatar);
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

    // Join game
    joinGame() {
        const roomCode = this.roomCodeInput.value.trim().toUpperCase();
        const playerName = this.playerNameInput.value.trim();

        // Validation
        if (!roomCode || roomCode.length !== 4) {
            this.showError(this.joinError, 'Please enter a valid 4-letter room code');
            return;
        }

        if (!playerName || playerName.length < 1) {
            this.showError(this.joinError, 'Please enter your name');
            return;
        }

        if (playerName.length > 12) {
            this.showError(this.joinError, 'Name must be 12 characters or less');
            return;
        }

        this.joinBtn.disabled = true;
        this.joinBtn.textContent = 'Joining...';

        this.socket.emit('joinRoom', {
            roomCode,
            playerName,
            avatar: this.playerAvatar
        }, (response) => {
            this.joinBtn.disabled = false;
            this.joinBtn.textContent = 'Join Game';

            if (response.success) {
                this.roomCode = roomCode;
                this.playerId = response.playerId;
                this.playerName = playerName;
                this.savePlayerData();

                this.myAvatarDisplay.textContent = this.playerAvatar;
                this.myNameDisplay.textContent = playerName;
                this.scoreAvatar.textContent = this.playerAvatar;

                this.updatePlayersList(response.players);
                this.showScreen('waiting');
            } else {
                this.showError(this.joinError, response.error);
            }
        });
    }

    // Update players list
    updatePlayersList(players) {
        this.lobbyPlayersList.innerHTML = players.map(player => `
            <li>
                <span class="avatar">${player.avatar}</span>
                <span class="name">${this.escapeHtml(player.name)}</span>
            </li>
        `).join('');
    }

    // Submit lie
    submitLie() {
        const lie = this.lieInput.value.trim();

        if (!lie) {
            this.showError(this.lieError, 'Please enter a lie');
            return;
        }

        this.submitLieBtn.disabled = true;
        this.submitLieBtn.textContent = 'Submitting...';

        this.socket.emit('submitLie', {
            roomCode: this.roomCode,
            lie
        });
    }

    // Submit vote
    submitVote(answerId) {
        this.socket.emit('submitVote', {
            roomCode: this.roomCode,
            answerId
        });
    }

    // Error display helpers
    showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.textContent = '';
            element.style.display = 'none';
        }, 3000);
    }

    // Socket event handlers
    onPlayerListUpdated(data) {
        this.updatePlayersList(data.players);
    }

    onRoundStart(data) {
        this.currentRound = data.round;
        this.showScreen('writingLie');

        this.writingRound.textContent = data.round;
        this.playerWritingTimer.textContent = data.timeLimit;
        this.playerCategory.textContent = data.category;
        this.playerQuestion.textContent = data.question;

        // Reset lie input
        this.lieInput.value = '';
        this.charCount.textContent = '0';
        this.submitLieBtn.disabled = false;
        this.submitLieBtn.textContent = 'Submit Lie';
        this.lieSubmitted.classList.add('hidden');
        this.lieInput.parentElement.style.display = 'block';
        this.lieError.textContent = '';
    }

    onYourLieId(data) {
        this.myLieId = data.lieId;
    }

    onVotingStart(data) {
        this.showScreen('votingChoices');

        this.playerVotingTimer.textContent = data.timeLimit;
        this.votingQuestion.textContent = data.question;

        // Display choices
        this.choicesContainer.innerHTML = data.answers.map((answer, index) => {
            const isMyLie = answer.id === this.myLieId;
            return `
                <button class="choice-btn ${isMyLie ? 'disabled' : ''}"
                        data-answer-id="${answer.id}"
                        ${isMyLie ? 'disabled' : ''}
                        style="animation-delay: ${0.05 * index}s">
                    ${this.escapeHtml(answer.text)}
                    ${isMyLie ? '<span class="your-lie-label">(Your lie)</span>' : ''}
                </button>
            `;
        }).join('');

        // Bind click events to choice buttons
        this.choicesContainer.querySelectorAll('.choice-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove selected from all
                this.choicesContainer.querySelectorAll('.choice-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                btn.classList.add('selected');
                this.submitVote(btn.dataset.answerId);
            });
        });

        this.voteSubmitted.classList.add('hidden');
        this.voteError.textContent = '';
    }

    onRoundResults(data) {
        this.showScreen('resultsWaiting');

        // Find my result
        const myResult = data.playerResults.find(p => p.id === this.playerId);
        if (myResult) {
            this.totalScore = myResult.totalScore;

            // Show score update after a delay
            setTimeout(() => {
                this.showScreen('scoreUpdate');

                const roundScore = myResult.roundScore || 0;
                this.scoreChange.textContent = roundScore > 0 ? `+${roundScore}` : '0';
                this.scoreChange.classList.toggle('zero', roundScore === 0);
                this.totalScoreDisplay.textContent = this.totalScore.toLocaleString();

                // Build score details
                let detailsHtml = '';
                if (myResult.votedCorrectly) {
                    detailsHtml += `
                        <div class="score-detail-item">
                            <span class="label">Found the truth</span>
                            <span class="value">+1,000</span>
                        </div>
                    `;
                }

                const fooledCount = myResult.fooledPlayers?.length || 0;
                if (fooledCount > 0) {
                    detailsHtml += `
                        <div class="score-detail-item">
                            <span class="label">Fooled ${fooledCount} player${fooledCount > 1 ? 's' : ''}</span>
                            <span class="value">+${(fooledCount * 500).toLocaleString()}</span>
                        </div>
                    `;
                }

                if (!detailsHtml) {
                    detailsHtml = `
                        <div class="score-detail-item">
                            <span class="label">Better luck next round!</span>
                            <span class="value">+0</span>
                        </div>
                    `;
                }

                this.scoreDetails.innerHTML = detailsHtml;
            }, 2000);
        }
    }

    onScoreboard(data) {
        // Just wait on the score update screen
        // The host will start the next round
    }

    onGameOver(data) {
        this.showScreen('gameover');

        // Find my position
        const myPosition = data.scores.findIndex(p => p.id === this.playerId) + 1;
        const myScore = data.scores.find(p => p.id === this.playerId)?.score || 0;

        this.finalPosition.querySelector('.position-number').textContent = `#${myPosition}`;
        this.finalScoreValue.textContent = myScore.toLocaleString();
    }

    onTimerUpdate(data) {
        const time = data.time;

        // Update visible timer based on current screen
        if (this.screens.writingLie.classList.contains('active')) {
            this.playerWritingTimer.textContent = time;
            this.updateTimerClass(this.playerWritingTimer, time);
        } else if (this.screens.votingChoices.classList.contains('active')) {
            this.playerVotingTimer.textContent = time;
            this.updateTimerClass(this.playerVotingTimer, time);
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

    onLieAccepted() {
        this.submitLieBtn.disabled = true;
        this.submitLieBtn.textContent = 'Submitted!';
        this.lieInput.parentElement.style.display = 'none';
        this.lieSubmitted.classList.remove('hidden');
    }

    onLieRejected(data) {
        this.submitLieBtn.disabled = false;
        this.submitLieBtn.textContent = 'Submit Lie';
        this.showError(this.lieError, data.reason);
    }

    onVoteAccepted() {
        this.choicesContainer.querySelectorAll('.choice-btn').forEach(btn => {
            if (!btn.classList.contains('selected')) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            }
        });
        this.voteSubmitted.classList.remove('hidden');
    }

    onVoteRejected(data) {
        this.choicesContainer.querySelectorAll('.choice-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        this.showError(this.voteError, data.reason);
    }

    onHostDisconnected() {
        this.disconnectReason.textContent = 'The host has ended the game.';
        this.showScreen('disconnected');
    }

    onNotEnoughPlayers() {
        this.disconnectReason.textContent = 'Not enough players remaining.';
        this.showScreen('disconnected');
    }

    onGameRestarted(data) {
        this.totalScore = 0;
        this.currentRound = 0;
        this.myLieId = null;
        this.updatePlayersList(data.players);
        this.showScreen('waiting');
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
    window.fibbagePlayer = new FibbagePlayer();
});
