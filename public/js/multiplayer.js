// Socket.IO connection and multiplayer handling
let socket;
let gameId;
let playerColor;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing multiplayer");
    
    // Check if the board is initialized immediately
    ensureChessBoardIsCreated();
    
    // Initialize Socket.IO with reconnection options
    socket = io({
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });
    window.socket = socket;
    
    // Add debug output
    const gameStatusEl = document.getElementById('game-status');
    if (gameStatusEl) {
        gameStatusEl.innerHTML += '<br><span style="color: blue;">Connecting to server...</span>';
    }
    
    // Extract game ID from URL if present
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 2 && pathParts[1] === 'game') {
        gameId = pathParts[2];
        window.gameId = gameId;
        
        // Update the game ID display immediately
        const gameIdElement = document.getElementById('game-id');
        if (gameIdElement) {
            gameIdElement.textContent = gameId;
            console.log("Set game ID display to:", gameId);
        }
        
        // Join the game when socket is connected
        socket.on('connect', joinGame);
    } else {
        console.log("Not in a game yet - on landing page");
    }
    
    // Function to join the game
    function joinGame() {
        console.log("Socket connected, joining game:", gameId);
        socket.emit('joinGame', gameId);
        // Set status text
        if (gameStatusEl) {
            gameStatusEl.innerHTML = 'Connecting to game...<br><span style="color: green;">Socket connected!</span>';
        }
    }
    
    // Function to ensure chess board is created
    function ensureChessBoardIsCreated() {
        setTimeout(() => {
            if (!window.boardInitialized && typeof createBoard === 'function') {
                console.log("Board not initialized after timeout - creating it now");
                createBoard();
            }
        }, 1000);
    }
    
    // Set up copy link button
    const copyBtn = document.getElementById('copy-link');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyGameLink);
    }
    
    // Socket event handlers
    
    // When player joins a game
    socket.on('gameJoined', (data) => {
        console.log("Game joined event received:", data);
        playerColor = data.color;
        window.playerColor = playerColor;
        
        const playerColorElement = document.getElementById('player-color');
        if (playerColorElement) {
            playerColorElement.textContent = playerColor;
        }
        
        if (playerColor === 'spectator') {
            document.getElementById('game-status').textContent = 'You are spectating this game';
            
            // Disable dragging for spectators
            const pieces = document.querySelectorAll('.piece');
            pieces.forEach(piece => {
                piece.setAttribute('draggable', false);
            });
        }
        
        // Make sure we have chess pieces
        if (!window.boardInitialized) {
            console.log("Creating board in gameJoined event");
            createBoard();
        } else {
            console.log("Board already initialized in gameJoined event");
        }
    });
    
    // When receiving a color assignment
    socket.on('assignColor', (color) => {
        console.log(`Received color assignment: ${color}`);
        playerColor = color;
        window.playerColor = color;
        
        const playerColorElement = document.getElementById('player-color');
        if (playerColorElement) {
            playerColorElement.textContent = color;
        }
        
        if (color === 'spectator') {
            document.getElementById('game-status').textContent = 'You are spectating this game';
            
            // Disable dragging for spectators
            const pieces = document.querySelectorAll('.piece');
            pieces.forEach(piece => {
                piece.setAttribute('draggable', false);
            });
        } else {
            // Make sure the board is created when color is assigned
            if (!window.boardInitialized) {
                console.log("Creating board after color assignment");
                createBoard();
            } else {
                console.log("Board already initialized in assignColor event");
                // Still set up the pieces based on color
                setupPiecesForPlayerColor(color);
            }
        }
    });
    
    // When game is ready to start
    socket.on('gameReady', (data) => {
        console.log("Game ready event received:", data);
        document.getElementById('game-status').textContent = 'Game is ready! White player goes first.';
        
        // Make sure the board is created and visible
        if (!window.boardInitialized) {
            console.log("Creating board on game ready");
            createBoard();
        } else {
            console.log("Board already initialized in gameReady event");
        }
        
        // Set up pieces based on player color
        setupPiecesForPlayerColor(playerColor);
    });
    
    // When waiting for more players
    socket.on('waitingForPlayers', (data) => {
        console.log("Waiting for players event received:", data);
        const { playersCount, missingColor } = data;
        document.getElementById('game-status').textContent = `Waiting for ${missingColor} player to join...`;
    });

    // When an opponent makes a move
    socket.on('opponentMove', (moveData) => {
        console.log('Opponent move received:', moveData);
        
        // Find source and target squares
        const fromSquare = document.querySelector(`[square-id="${moveData.from}"]`);
        const toSquare = document.querySelector(`[square-id="${moveData.to}"]`);
        
        if (!fromSquare || !toSquare) {
            console.error('Could not find source or target square');
            return;
        }
        
        // Find the piece
        const pieceElement = fromSquare.querySelector(`#${moveData.piece}`);
        if (!pieceElement) {
            console.error('Could not find piece element');
            return;
        }
        
        // Make the move
        if (moveData.capture) {
            toSquare.innerHTML = '';
        }
        toSquare.appendChild(pieceElement);
        
        // Update turn indicator
        change_player();
        
        // Update which pieces can be moved
        if (typeof updateDraggableState === 'function') {
            updateDraggableState();
        }
    });

    // When receiving game state
    socket.on('gameState', (gameState) => {
        console.log('Received game state:', gameState);
        if (gameState && gameState.currentPlayer) {
            // Update the global player variable
            window.player = gameState.currentPlayer;
            
            // Update the player turn display
            if (player_turn) {
                player_turn.textContent = gameState.currentPlayer.toUpperCase();
            }
            
            // Update which pieces can be moved based on the new turn
            if (typeof updateDraggableState === 'function') {
                updateDraggableState();
            }
        }
    });

    // When a player disconnects
    socket.on('playerDisconnected', (color) => {
        console.log(`Player with color ${color} disconnected`);
        document.getElementById('game-status').textContent = `${color} player disconnected`;
    });

    // Connection debug
    socket.on('connect', () => {
        console.log('Connected to server with socket ID:', socket.id);
        connectionAttempts = 0;
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        connectionAttempts++;
        
        if (connectionAttempts <= MAX_CONNECTION_ATTEMPTS) {
            console.log(`Connection attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS} failed, retrying...`);
        } else {
            document.getElementById('game-status').textContent = 'Failed to connect to server.';
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        document.getElementById('game-status').textContent = 'Disconnected from server. Trying to reconnect...';
    });
    
    socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected to server after ${attemptNumber} attempts`);
        document.getElementById('game-status').textContent = 'Reconnected!';
        
        // Rejoin the game if we have a game ID
        if (gameId) {
            joinGame();
        }
    });
    
    socket.on('error', (error) => {
        console.error('Server error:', error);
    });
    
    // Listen for global errors
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
    });
});

// Function to copy the game link
function copyGameLink() {
    const gameUrl = window.location.href;
    console.log("Copying URL:", gameUrl);
    
    // Create temporary element
    const tempElement = document.createElement("textarea");
    tempElement.value = gameUrl;
    document.body.appendChild(tempElement);
    
    // Select and copy
    tempElement.select();
    
    try {
        const success = document.execCommand("copy");
        if (success) {
            alert("Game link copied to clipboard! Share it with your opponent.");
        } else {
            fallbackCopy(gameUrl);
        }
    } catch (err) {
        console.error("Copy failed:", err);
        fallbackCopy(gameUrl);
    }
    
    // Clean up
    document.body.removeChild(tempElement);
    
    // Try modern clipboard API as backup
    if (navigator.clipboard) {
        navigator.clipboard.writeText(gameUrl)
            .catch(err => console.error('Clipboard API failed:', err));
    }
}

function fallbackCopy(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
            .then(() => {
                alert('Game link copied to clipboard! Share it with your opponent.');
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy link. Please copy the URL from your address bar.');
            });
    } else {
        alert('Failed to copy link. Please copy the URL from your address bar.');
    }
}

// Function to set up pieces based on player color
function setupPiecesForPlayerColor(color) {
    console.log(`Setting up board for ${color} player`);
    
    // Make sure we have a board before setting up pieces
    if (!window.boardInitialized) {
        console.log("Can't set up pieces - board not initialized yet");
        return;
    }
    
    // Store player color in global window object so it's accessible everywhere
    window.playerColor = color;
    
    // If we're the black player, we might need to rotate the board
    if (color === 'black') {
        // If the revertIds function exists, use it to set up the board for black
        if (typeof revertIds === 'function') {
            console.log("Setting up board for black player");
            revertIds();
        }
    } else {
        // If the reverseIds function exists, use it to set up the board for white
        if (typeof reverseIds === 'function') {
            console.log("Setting up board for white player");
            reverseIds();
        }
    }
    
    // Update draggable state for pieces based on both player color and current turn
    updateDraggableState();
    
    console.log(`Finished setting up board for ${color} player`);
}

// Function to update which pieces are draggable based on both player color and whose turn it is
function updateDraggableState() {
    // Get all pieces
    const pieces = document.querySelectorAll('.piece');
    
    // Get current game state
    const currentTurn = window.player;
    const myColor = window.playerColor;
    
    console.log(`Updating draggable state: My color: ${myColor}, Current turn: ${currentTurn}`);
    
    // DEBUGGING: Log the state of all pieces
    let whitePieces = 0;
    let blackPieces = 0;
    let draggablePieces = 0;
    
    // Update each piece
    pieces.forEach(piece => {
        // A piece is yours if it matches your color
        const isPieceYours = piece.firstChild?.classList.contains(myColor);
        
        // Count pieces for debugging
        if (piece.firstChild?.classList.contains('white')) whitePieces++;
        if (piece.firstChild?.classList.contains('black')) blackPieces++;
        
        // A piece should be draggable if it's yours AND it's your turn
        const shouldBeDraggable = isPieceYours && myColor === currentTurn;
        
        // Set draggable attribute
        piece.setAttribute('draggable', shouldBeDraggable);
        if (shouldBeDraggable) draggablePieces++;
        
        // Add visual indicator for pieces that are yours
        if (isPieceYours) {
            piece.classList.add('your-piece');
        } else {
            piece.classList.remove('your-piece');
        }
        
        // Add extra visual indicator for pieces that can be moved right now
        if (shouldBeDraggable) {
            piece.classList.add('can-move');
        } else {
            piece.classList.remove('can-move');
        }
    });
    
    // Log debugging info
    console.log(`Pieces stats - White: ${whitePieces}, Black: ${blackPieces}, Draggable: ${draggablePieces}`);
    if (draggablePieces === 0) {
        console.warn(`WARNING: No pieces are draggable! myColor=${myColor}, currentTurn=${currentTurn}`);
        // Force draggability for testing if needed
        
        // DEBUGGING MODE ENABLED: Force draggability for testing
        if (myColor) {
            pieces.forEach(piece => {
                if (piece.firstChild?.classList.contains(myColor)) {
                    piece.setAttribute('draggable', true);
                    piece.classList.add('can-move');
                    console.log(`Made piece ${piece.id} draggable for testing`);
                }
            });
            console.log("TESTING MODE: Forced your pieces to be draggable");
        }
        
    }
}