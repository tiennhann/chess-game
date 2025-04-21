# Chess Game Collection

A versatile chess application featuring multiple game modes including multiplayer functionality.

## Features

- **Multiplayer Chess**: Play chess online with friends in real-time
- **Standard Chess**: Play a regular game of chess on the same device
- **Debug & Development Modes**: Several testing variants for development

## Demo

![Chess Game Screenshot](https://via.placeholder.com/600x400?text=Chess+Game+Screenshot)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chess.git
cd chess
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## Game Modes

### Multiplayer Chess

Play chess online with friends. Create a new game and share the game ID with a friend to join.

- Create a new game by clicking "Create New Game"
- Join an existing game by entering the Game ID and clicking "Join Game"
- Share your Game ID by clicking the "Copy Game Link" button

### Standard Chess

Play a regular game of chess locally on the same device.

### Fixed Chess

A simplified version with basic functionality for testing purposes.

### Debug Chess

Developer version with all pieces draggable for testing and development.

## Technical Details

### Architecture

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.IO

### File Structure

```
chess/
├── public/               # Static assets
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript files
│   │   ├── app.js       # Main chess logic
│   │   ├── pieces.js    # Chess piece definitions
│   │   └── multiplayer.js # Multiplayer functionality
│   ├── index.html       # Main entry page
│   ├── multiplayer.html # Multiplayer game page
│   ├── chess.html       # Standard chess game
│   └── ...              # Other HTML pages
├── server.js            # Express server & Socket.IO handling
├── game-manager.js      # Game state management
├── package.json         # Dependencies
└── README.md            # This file
```

## Game Mechanics

- **Piece Movement**: Standard chess rules for piece movement
- **Turn-Based**: Alternates between white and black players
- **Game State**: Tracks player turns, captured pieces, and game status
- **Multiplayer**: Real-time synchronization of game state between players

## Development

### Running in Development Mode

```bash
npm run dev
```

This will start the server with nodemon for automatic reloading when files change.

### Debugging

The application includes several debugging tools:

- `/debug` - General debug tools
- `/test` - Resource testing page
- `/debug-chess` - Chess board with enhanced debugging features

Enable Socket.IO debugging with:

```bash
DEBUG=socket.io* npm start
```

## License

[MIT](LICENSE)

## Acknowledgements

- Chess piece SVGs from FontAwesome
- Socket.IO for real-time communication
- Node.js and Express for the server framework