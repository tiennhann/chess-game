const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const GameManager = require('./game-manager');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const gameManager = new GameManager();

// Set up static files with proper MIME types
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
            res.set('Content-Type', 'text/css');
        }
    }
}));

// Track socket-to-game mapping
const socketToGame = {};

// Route for creating a new game
app.get('/new-game', (req, res) => {
    const gameId = gameManager.createGame();
    console.log(`Creating new game with ID: ${gameId}`);
    
    res.redirect(`/game/${gameId}`);
});

// Route for joining a specific game
app.get('/game/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    console.log(`Request to join game: ${gameId}`);
    
    if (!gameManager.gameExists(gameId)) {
        console.log(`Game ${gameId} not found, creating it`);
        gameManager.createGame();
    }
    
    res.sendFile(path.join(__dirname, 'public', 'multiplayer.html'));
});

// Add this route handler
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add a route for the fixed chess game
app.get('/fix', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'fix-chess.html'));
});

// Add a route for the simple standalone chess game
app.get('/chess', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chess.html'));
});

// Add a route for debug-chess
app.get('/debug-chess', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'debug-chess.html'));
});

// Add a debug route for troubleshooting
app.get('/debug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'debug.html'));
});

// Add a route for testing resources
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// Debug endpoint to list all active games
app.get('/debug/games', (req, res) => {
    const games = Object.keys(gameManager.games).map(gameId => {
        const game = gameManager.getGame(gameId);
        return {
            id: gameId,
            playerCount: game.players.length,
            players: game.players.map(p => ({ id: p.id, color: p.color }))
        };
    });
    
    res.json({ games });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected with ID:', socket.id);
    
    // Player joins a game
    socket.on('joinGame', (gameId) => {
        console.log(`Player ${socket.id} joining game ${gameId}`);
        
        if (!gameManager.gameExists(gameId)) {
            console.log(`Game ${gameId} not found for player ${socket.id}, creating it`);
            gameId = gameManager.createGame(gameId);
            console.log(`New game created with ID: ${gameId}`);
        }

        // Store the game ID for this socket
        socketToGame[socket.id] = gameId;
        
        // Join the socket room for this game
        socket.join(gameId);

        // Add player to game and get assigned color
        const playerColor = gameManager.addPlayer(gameId, socket.id);
        
        // Send color assignment to the player
        socket.emit('assignColor', playerColor);
        
        // Also send a gameJoined event with the color
        socket.emit('gameJoined', { color: playerColor });

        // Get the current game state
        const game = gameManager.getGame(gameId);
        
        // If there are two players, notify about game ready
        if (game && game.players && game.players.length === 2) {
            console.log(`Game ${gameId} has 2 players, sending gameReady event`);
            io.to(gameId).emit('gameReady', game);
        } else if (game) {
            socket.emit('waitingForPlayers', { 
                playersCount: game.players ? game.players.length : 0, 
                missingColor: game.players && game.players[0] ? game.players[0].color === 'white' ? 'black' : 'white' : 'white'
            });
        }
        
        // Send current game state
        socket.emit('gameState', game);
    });

    // Handle move from client
    socket.on('makeMove', (data) => {
        const gameId = data.gameId || socketToGame[socket.id];
        if (!gameId || !gameManager.gameExists(gameId)) {
            console.error(`No valid game for move from socket ${socket.id}`);
            return;
        }
        
        const game = gameManager.getGame(gameId);
        
        // Validate it's the player's turn
        const player = game && game.players ? game.players.find(p => p.id === socket.id) : null;
        if (!player || !game || !game.currentPlayer || player.color !== game.currentPlayer) {
            console.log(`Not player's turn: ${socket.id} (${player?.color}) vs ${game?.currentPlayer}`);
            socket.emit('error', 'Not your turn');
            return;
        }

        // Make the move
        if (gameManager.makeMove(gameId, data)) {
            // Get updated game state
            const updatedGame = gameManager.getGame(gameId);
            
            // Broadcast the move to other players
            socket.to(gameId).emit('opponentMove', data);
            
            // Broadcast updated state to all players
            io.to(gameId).emit('gameState', updatedGame);
        } else {
            socket.emit('error', 'Invalid move');
        }
    });

    // Handle disconnections
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        
        // Get the game this socket was in
        const gameId = socketToGame[socket.id];
        if (gameId && gameManager.gameExists(gameId)) {
            // Get player color before removal
            const game = gameManager.getGame(gameId);
            const player = game.players.find(p => p.id === socket.id);
            const playerColor = player ? player.color : 'spectator';
            
            // Remove player from game
            gameManager.removePlayer(gameId, socket.id);
            
            // Clean up the socket mapping
            delete socketToGame[socket.id];
            
            // Notify remaining players if the game still exists
            if (gameManager.gameExists(gameId)) {
                io.to(gameId).emit('playerDisconnected', playerColor);
            }
        }
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});