const { v4: uuidv4 } = require('uuid');

class GameManager {
  constructor() {
    this.games = {};
  }

  createGame(providedId = null) {
    const gameId = providedId || uuidv4().substring(0, 8);
    
    this.games[gameId] = {
      id: gameId,
      players: [],
      currentPlayer: 'white',
      board: this.createInitialBoard(),
      gameOver: false,
      winner: null,
      moves: []
    };
    
    console.log(`Game created with ID: ${gameId}`);
    return gameId;
  }

  gameExists(gameId) {
    return !!this.games[gameId];
  }

  getGame(gameId) {
    return this.games[gameId];
  }

  addPlayer(gameId, socketId) {
    if (!this.gameExists(gameId)) {
      return null;
    }
    
    const game = this.games[gameId];
    
    // Check if player is already in the game
    const existingPlayer = game.players.find(p => p.id === socketId);
    if (existingPlayer) {
      console.log(`Player ${socketId} already in game ${gameId} as ${existingPlayer.color}`);
      return existingPlayer.color;
    }
    
    // Assign color based on available slots
    let color = null;
    if (game.players.length === 0) {
      color = 'white';
    } else if (game.players.length === 1) {
      // Make sure we don't assign the same color twice
      const existingColor = game.players[0].color;
      color = existingColor === 'white' ? 'black' : 'white';
    } else {
      // If game is full, assign as spectator
      color = 'spectator';
    }
    
    // Add player to game
    game.players.push({ id: socketId, color });
    console.log(`Player ${socketId} added to game ${gameId} as ${color}`);
    console.log(`Game ${gameId} now has ${game.players.length} players`);
    
    return color;
  }

  removePlayer(gameId, socketId) {
    if (!this.gameExists(gameId)) {
      return false;
    }
    
    const game = this.games[gameId];
    const initialPlayerCount = game.players.length;
    
    game.players = game.players.filter(p => p.id !== socketId);
    
    console.log(`Player ${socketId} removed from game ${gameId}`);
    console.log(`Game ${gameId} now has ${game.players.length} players (was ${initialPlayerCount})`);
    
    // Clean up empty games
    if (game.players.length === 0) {
      console.log(`Deleting empty game ${gameId}`);
      delete this.games[gameId];
    }
    
    return true;
  }

  makeMove(gameId, moveData) {
    if (!this.gameExists(gameId)) {
      return false;
    }
    
    const game = this.games[gameId];
    
    // Add move to history
    game.moves.push(moveData);
    
    // Update current player
    game.currentPlayer = game.currentPlayer === 'white' ? 'black' : 'white';
    
    console.log(`Move made in game ${gameId}: ${moveData.from} -> ${moveData.to}`);
    console.log(`Current player is now: ${game.currentPlayer}`);
    
    return true;
  }

  createInitialBoard() {
    // Return a representation of the initial chess board
    // For this simple implementation, we'll return an empty object
    // In a real game, this would contain the initial state of all pieces
    return {};
  }
}

module.exports = GameManager;