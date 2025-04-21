module.exports = function setupSocketHandlers(io, gameManager) {
  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    let currentGameId = null;
    let currentPlayerColor = null;

    // Handle player joining a game
    socket.on('joinGame', (gameId) => {
      if (!gameManager.gameExists(gameId)) {
        socket.emit('error', 'Game not found');
        return;
      }
      
      // Add player to game and get assigned color
      currentPlayerColor = gameManager.addPlayer(gameId, socket.id);
      currentGameId = gameId;
      
      // Join socket room for this game
      socket.join(gameId);
      
      // Send current game state
      const gameState = gameManager.getGame(gameId);
      socket.emit('gameJoined', { color: currentPlayerColor, gameState });
      
      // Notify all players in the game
      const playersCount = gameState.players.length;
      if (playersCount === 2) {
        io.to(gameId).emit('gameReady', { gameState });
      } else {
        io.to(gameId).emit('waitingForPlayers', { 
          playersCount, 
          missingColor: currentPlayerColor === 'white' ? 'black' : 'white' 
        });
      }
    });

    // Handle move from client
    socket.on('makeMove', (move) => {
      const { gameId, from, to, piece, capture } = move;
      
      if (!gameManager.gameExists(gameId)) {
        socket.emit('error', 'Game not found');
        return;
      }
      
      const game = gameManager.getGame(gameId);
      
      // Verify it's player's turn
      const playerData = game.players.find(p => p.id === socket.id);
      if (!playerData || playerData.color !== game.currentPlayer) {
        socket.emit('error', 'Not your turn');
        return;
      }
      
      // Create move data with player information
      const moveData = {
        from,
        to,
        piece,
        capture,
        player: playerData.color,
        capturedPiece: move.capturedPiece || null
      };
      
      // Apply the move
      if (gameManager.makeMove(gameId, moveData)) {
        // Get updated game state
        const updatedGame = gameManager.getGame(gameId);
        
        // Broadcast to all players in the game
        io.to(gameId).emit('moveMade', {
          move: moveData,
          gameState: updatedGame
        });
        
        // Check for game over
        if (updatedGame.gameOver) {
          io.to(gameId).emit('gameOver', {
            winner: updatedGame.winner,
            gameState: updatedGame
          });
        }
      } else {
        socket.emit('error', 'Invalid move');
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Connection disconnected: ${socket.id}`);
      
      if (currentGameId) {
        // Find player color if available
        const game = gameManager.getGame(currentGameId);
        if (game) {
          const player = game.players.find(p => p.id === socket.id);
          const playerColor = player ? player.color : 'spectator';
          
          // Remove player from game
          gameManager.removePlayer(currentGameId, socket.id);
          
          // Notify other players
          io.to(currentGameId).emit('playerDisconnected', {
            color: playerColor,
            gameState: gameManager.getGame(currentGameId) || { gameOver: true }
          });
        }
      }
    });
  });
};
