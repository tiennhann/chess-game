const game_board = document.querySelector("#gameboard");
const player_turn = document.querySelector("#player-turn");
const info_display = document.querySelector("#info-display");
const err = document.querySelector("#err");
const width = 8

// Make these window properties so they're accessible globally
window.player = 'white';
if (player_turn) {
    player_turn.textContent = 'white';
}

const start_pieces = [
    rook, knight, bishop, queen, king, bishop, knight, rook,
    pawn, pawn, pawn, pawn, pawn, pawn, pawn, pawn,
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    pawn, pawn, pawn, pawn, pawn, pawn, pawn, pawn,
    rook, knight, bishop, queen, king, bishop, knight, rook,
]

// Make sure we only create the board once 
// IMPORTANT: Set as a property on window so it's accessible everywhere
window.boardInitialized = false;

function createBoard() {
    // Don't create the board twice
    if (window.boardInitialized) {
        console.log("Board already initialized, skipping");
        return;
    }
    
    console.log("Creating chess board");
    
    // Check if the gameboard element exists
    const board = document.querySelector("#gameboard");
    if (!board) {
        console.error("Cannot find #gameboard element!");
        return;
    }
    
    // Clear any existing pieces first
    board.innerHTML = '';
    
    // Track whether we're adding pieces successfully
    let piecesAdded = 0;
    
    // Add a log to help with debugging
    console.log("Start pieces array length:", start_pieces.length);
    
    // Force the chess piece definitions if needed
    if (typeof pawn === 'undefined' || typeof rook === 'undefined' || typeof knight === 'undefined' ||
        typeof bishop === 'undefined' || typeof queen === 'undefined' || typeof king === 'undefined') {
        console.error("Chess pieces are not defined! Using Unicode fallbacks.");
        
        // Create fallback pieces using Unicode characters
        window.king = '<div class="piece" id="king">♔</div>';
        window.queen = '<div class="piece" id="queen">♕</div>';
        window.bishop = '<div class="piece" id="bishop">♗</div>';
        window.knight = '<div class="piece" id="knight">♘</div>';
        window.rook = '<div class="piece" id="rook">♖</div>';
        window.pawn = '<div class="piece" id="pawn">♙</div>';
    }
    
    start_pieces.forEach((start_piece, i) => {
        const square = document.createElement("div");
        square.classList.add("square");
        square.innerHTML = start_piece;
        piecesAdded += start_piece ? 1 : 0;

        square.setAttribute("square-id", i);
        if (square.firstChild) {
            square.firstChild.setAttribute('draggable', true);
        }

        const row = Math.floor((63 - i) / 8) + 1;

        if (row % 2 === 0) {
            square.classList.add(i % 2 == 0 ? "beige" : "brown");
        } else {
            square.classList.add(i % 2 == 0 ? "brown" : "beige");
        }

        // Add color classes to pieces safely with null checks
        if (i <= 15 && square.firstChild && square.firstChild.firstChild) {
            square.firstChild.firstChild.classList.add("black");
        }
        if (i >= 48 && square.firstChild && square.firstChild.firstChild) {
            square.firstChild.firstChild.classList.add("white");
        }

        board.append(square);
    });
    
    console.log(`Chess board created with ${piecesAdded} pieces added`);
    window.boardInitialized = true;
    
    // Now that the squares exist, set up the event listeners
    setupEventListeners();
}

// Setup event listeners for dragging and dropping pieces
function setupEventListeners() {
    // Define all_squares globally so it's accessible to other functions
    window.all_squares = document.querySelectorAll("#gameboard .square");
    console.log("Setting up event listeners for", window.all_squares.length, "squares");
    
    window.all_squares.forEach(square => {
        square.addEventListener('dragstart', drag_start);
        square.addEventListener('dragend', drag_end);
        square.addEventListener('dragover', drag_over);
        square.addEventListener('drop', drag_drop);
    });
    
    // Return the board to its starting rotation for white
    reverseIds();
}

let start_positionId
let dragged_element

function drag_start(e) {
    // DEBUGGING MODE: Allow any piece to be dragged during testing
    const debugMode = true; 
    
    // Get the current turn and player color from the global state
    const currentTurn = window.player;
    const myColor = window.playerColor;
    
    console.log(`Drag start: myColor=${myColor}, currentTurn=${currentTurn}`);
    console.log(`Piece being dragged: ${e.target.id} with firstChild classes: ${e.target.firstChild?.className}`);
    
    // If in debug mode, allow any piece to be dragged
    if (debugMode) {
        start_positionId = e.target.parentNode.getAttribute("square-id");
        dragged_element = e.target;
        
        // Add visual feedback
        dragged_element.classList.add('moving');
        
        // Show legal moves
        highlight_move(dragged_element.id, start_positionId);
        return;
    }
    
    // Prevent drag if not your turn in multiplayer mode
    if (window.socket && window.gameId) {
        if (myColor !== currentTurn) {
            console.log("Not your turn! Current turn:", currentTurn, "Your color:", myColor);
            if (info_display) {
                info_display.textContent = "Not your turn!";
                setTimeout(() => info_display.textContent = "", 2000);
            }
            e.preventDefault();
            return false;
        }
        
        // Make sure the piece belongs to the player
        const pieceColor = e.target.firstChild?.classList.contains(myColor) ? myColor : null;
        if (!pieceColor) {
            console.log("Not your piece! Your color:", myColor);
            if (info_display) {
                info_display.textContent = "Not your piece!";
                setTimeout(() => info_display.textContent = "", 2000);
            }
            e.preventDefault();
            return false;
        }
    } else {
        // For local play, use the original logic
        // Only allow dragging pieces of the current player's color
        const correct_turn = e.target.firstChild?.classList.contains(player);
        if (!correct_turn) {
            console.log("Not your piece! Current turn:", player);
            if (info_display) {
                info_display.textContent = "Not your piece!";
                setTimeout(() => info_display.textContent = "", 5000);
            }
            e.preventDefault();
            return false;
        }
    }
    
    start_positionId = e.target.parentNode.getAttribute("square-id")
    dragged_element = e.target
    
    // Add visual feedback
    dragged_element.classList.add('moving');
    
    highlight_move(dragged_element.id, start_positionId);
}

function drag_over(e) {
    e.preventDefault();
}

async function drag_drop(e) {
    e.stopPropagation();
    e.preventDefault(); // Ensure default is prevented
    clear_highlights();

    if (!dragged_element) {
        console.error("No dragged element found in drag_drop");
        return;
    }

    // We've already verified it's the player's turn in drag_start, so we can simplify this function
    const taken = e.target.classList.contains('piece');
    const valid = check_valid(e.target);
    const opponent_turn = player === 'white' ? 'black' : 'white';
    const taken_by_opponent = e.target.firstChild?.classList.contains(opponent_turn);

    // Log dropzone information for debugging
    console.log(`Drop target: ${e.target.tagName} with classes ${e.target.className}`);
    console.log(`Drop valid: ${valid}, Taken: ${taken}, By opponent: ${taken_by_opponent}`);

    // DEBUGGING MODE: Force drops to be valid during testing
    const forceDrops = true;

    if ((taken_by_opponent && valid) || (taken_by_opponent && forceDrops)) {
        // Store original state in case move is rejected by server
        const originalParent = dragged_element.parentNode;
        const targetParent = e.target.parentNode;
        const capturedPiece = e.target;
        
        // Animate capture
        await animateMove(dragged_element, e.target, true);
        e.target.parentNode.append(dragged_element);
        e.target.remove();
        
        // If in multiplayer mode, send move to server
        if (window.socket && window.gameId) {
            const moveData = {
                from: parseInt(originalParent.getAttribute('square-id')),
                to: parseInt(targetParent.getAttribute('square-id')),
                piece: dragged_element.id,
                gameId: window.gameId,
                capture: true
            };
            
            window.socket.emit('makeMove', moveData);
            console.log("Sent capture move to server:", moveData);
        } else {
            // Local play - continue with normal logic
            check_win();
            change_player();
        }
        return;
    }
    if (taken && !taken_by_opponent) {
        info_display.textContent = 'Cannot move there';
        setTimeout(() => info_display.textContent = '', 2000);
        return;
    }
    if (valid || forceDrops) {
        // Store original state
        const originalParent = dragged_element.parentNode;
        const targetSquare = e.target;
        
        // For a square element (not a piece)
        if (targetSquare.classList.contains('square')) {
            // Animate normal move
            await animateMove(dragged_element, targetSquare);
            targetSquare.append(dragged_element);
            
            // If in multiplayer mode, send move to server
            if (window.socket && window.gameId) {
                const moveData = {
                    from: parseInt(originalParent.getAttribute('square-id')),
                    to: parseInt(targetSquare.getAttribute('square-id')),
                    piece: dragged_element.id,
                    gameId: window.gameId,
                    capture: false
                };
                
                window.socket.emit('makeMove', moveData);
                console.log("Sent normal move to server:", moveData);
            } else {
                // Local play - continue with normal logic
                check_win();
                change_player();
            }
        } else {
            // For nested elements, find the nearest square parent
            const nearestSquare = targetSquare.closest('.square');
            if (nearestSquare) {
                await animateMove(dragged_element, nearestSquare);
                nearestSquare.append(dragged_element);
                
                // If in multiplayer mode, send move to server
                if (window.socket && window.gameId) {
                    const moveData = {
                        from: parseInt(originalParent.getAttribute('square-id')),
                        to: parseInt(nearestSquare.getAttribute('square-id')),
                        piece: dragged_element.id,
                        gameId: window.gameId,
                        capture: false
                    };
                    
                    window.socket.emit('makeMove', moveData);
                    console.log("Sent move to parent square:", moveData);
                } else {
                    // Local play - continue with normal logic
                    check_win();
                    change_player();
                }
            } else {
                console.error("Could not find a valid square to drop on");
                return;
            }
        }
        return;
    } else {
        console.warn(`Invalid drop: Valid=${valid}, Target=${e.target.className}`);
    }
}

function drag_end(e) {
    dragged_element.classList.remove('moving');
}

function check_valid(target) {
    const targetId = Number(target.getAttribute('square-id')) || Number(target.parentNode.getAttribute('square-id'));
    const startId = Number(start_positionId);
    const piece = dragged_element.id
    console.log(startId, targetId, piece)

    switch (piece) {
        case 'pawn':
            // Get pawn color to determine direction of movement
            const isPawnWhite = dragged_element.firstChild.classList.contains('white');
            const moveDirection = isPawnWhite ? -width : width; // White moves up (negative), black moves down (positive)
            
            // Starting rows for white and black pawns
            const whiteStartRow = [48, 49, 50, 51, 52, 53, 54, 55]; // Bottom row (white starting position)
            const blackStartRow = [8, 9, 10, 11, 12, 13, 14, 15];   // Second row from top (black starting position)
            
            // Determine if pawn is in its starting position
            const isInStartPosition = isPawnWhite ? whiteStartRow.includes(startId) : blackStartRow.includes(startId);
            
            // Normal one square forward move (no capture)
            if (startId + moveDirection === targetId && !document.querySelector(`[square-id="${targetId}"]`).firstChild) {
                return true;
            }
            
            // Two square forward move from starting position (no capture)
            if (isInStartPosition && 
                startId + moveDirection * 2 === targetId && 
                !document.querySelector(`[square-id="${startId + moveDirection}"]`).firstChild && 
                !document.querySelector(`[square-id="${targetId}"]`).firstChild) {
                return true;
            }
            
            // Diagonal captures (only if target has an opponent's piece)
            if ((startId + moveDirection - 1 === targetId || startId + moveDirection + 1 === targetId) && 
                document.querySelector(`[square-id="${targetId}"]`).firstChild) {
                // Ensure we're capturing an opponent's piece
                const targetPiece = document.querySelector(`[square-id="${targetId}"]`).firstChild;
                const isTargetWhite = targetPiece.classList.contains('white');
                if (isPawnWhite !== isTargetWhite) {
                    return true;
                }
            }
            
            // Pawn movement is invalid
            return false;
            
        case 'knight':
            if (
                startId + width * 2 + 1 === targetId ||
                startId + width * 2 - 1 === targetId ||
                startId + width - 2 === targetId ||
                startId + width + 2 === targetId ||
                startId - width * 2 + 1 === targetId ||
                startId - width * 2 - 1 === targetId ||
                startId - width + 2 === targetId ||
                startId - width - 2 === targetId
            ) {
                return true
            }
            break;

        case 'bishop':
            if (
                // for right cross --- forward
                startId + width + 1 === targetId ||
                startId + width * 2 + 2 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild ||
                startId + width * 3 + 3 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild ||
                startId + width * 4 + 4 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 + 3}"]`).firstChild ||
                startId + width * 5 + 5 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 + 4}"]`).firstChild ||
                startId + width * 6 + 6 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 + 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 5 + 5}"]`).firstChild ||
                startId + width * 7 + 7 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 + 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 5 + 5}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 6 + 6}"]`).firstChild ||

                // for left cross --- forward
                startId + width - 1 === targetId ||
                startId + width * 2 - 2 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild ||
                startId + width * 3 - 3 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild ||
                startId + width * 4 - 4 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 - 3}"]`).firstChild ||
                startId + width * 5 - 5 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 - 4}"]`).firstChild ||
                startId + width * 6 - 6 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 - 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 5 - 5}"]`).firstChild ||
                startId + width * 7 - 7 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 - 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 5 - 5}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 6 - 6}"]`).firstChild ||

                // for right cross --- backward
                startId - width - 1 === targetId ||
                startId - width * 2 - 2 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild ||
                startId - width * 3 - 3 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild ||
                startId - width * 4 - 4 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 - 3}"]`).firstChild ||
                startId - width * 5 - 5 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 - 4}"]`).firstChild ||
                startId - width * 6 - 6 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 - 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 5 - 5}"]`).firstChild ||
                startId - width * 7 - 7 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 - 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 5 - 5}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 6 - 6}"]`).firstChild ||

                // fot left cross -- backward
                startId - width + 1 === targetId ||
                startId - width * 2 + 2 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild ||
                startId - width * 3 + 3 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild ||
                startId - width * 4 + 4 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 + 3}"]`).firstChild ||
                startId - width * 5 + 5 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 + 4}"]`).firstChild ||
                startId - width * 6 + 6 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 + 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 5 + 5}"]`).firstChild ||
                startId - width * 7 + 7 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 + 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 5 + 5}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 6 + 6}"]`).firstChild
            ) {
                return true;
            }
            break;

        case 'rook':
            if (
                // moving straight forward
                startId + width === targetId ||
                startId + width * 2 === targetId && !document.querySelector(`[square-id="${startId + width}"]`).firstChild ||
                startId + width * 3 === targetId && !document.querySelector(`[square-id="${startId + width}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 2}"]`).firstChild ||
                startId + width * 4 === targetId && !document.querySelector(`[square-id="${startId + width}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 2}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 3}"]`).firstChild ||
                startId + width * 5 === targetId && !document.querySelector(`[square-id="${startId + width}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 2}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 3}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 4}"]`).firstChild ||
                startId + width * 6 === targetId && !document.querySelector(`[square-id="${startId + width}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 2}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 3}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 4}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 5}"]`).firstChild ||
                startId + width * 7 === targetId && !document.querySelector(`[square-id="${startId + width}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 2}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 3}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 4}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 5}"]`).firstChild && !document.querySelector(`[square-id="${startId + width * 6}"]`).firstChild ||

                // moving straight backward
                startId - width === targetId ||
                startId - width * 2 === targetId && !document.querySelector(`[square-id="${startId - width}"]`).firstChild ||
                startId - width * 3 === targetId && !document.querySelector(`[square-id="${startId - width}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 2}"]`).firstChild ||
                startId - width * 4 === targetId && !document.querySelector(`[square-id="${startId - width}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 2}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 3}"]`).firstChild ||
                startId - width * 5 === targetId && !document.querySelector(`[square-id="${startId - width}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 2}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 3}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 4}"]`).firstChild ||
                startId - width * 6 === targetId && !document.querySelector(`[square-id="${startId - width}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 2}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 3}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 4}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 5}"]`).firstChild ||
                startId - width * 7 === targetId && !document.querySelector(`[square-id="${startId - width}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 2}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 3}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 4}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 5}"]`).firstChild && !document.querySelector(`[square-id="${startId - width * 6}"]`).firstChild ||

                // moving left side straight
                startId + 1 === targetId ||
                startId + 2 === targetId && !document.querySelector(`[square-id="${startId + 1}"]`).firstChild ||
                startId + 3 === targetId && !document.querySelector(`[square-id="${startId + 1}"]`).firstChild && !document.querySelector(`[square-id="${startId + 2}"]`).firstChild ||
                startId + 4 === targetId && !document.querySelector(`[square-id="${startId + 1}"]`).firstChild && !document.querySelector(`[square-id="${startId + 2}"]`).firstChild && !document.querySelector(`[square-id="${startId + 3}"]`).firstChild ||
                startId + 5 === targetId && !document.querySelector(`[square-id="${startId + 1}"]`).firstChild && !document.querySelector(`[square-id="${startId + 2}"]`).firstChild && !document.querySelector(`[square-id="${startId + 3}"]`).firstChild && !document.querySelector(`[square-id="${startId + 4}"]`).firstChild ||
                startId + 6 === targetId && !document.querySelector(`[square-id="${startId + 1}"]`).firstChild && !document.querySelector(`[square-id="${startId + 2}"]`).firstChild && !document.querySelector(`[square-id="${startId + 3}"]`).firstChild && !document.querySelector(`[square-id="${startId + 4}"]`).firstChild && !document.querySelector(`[square-id="${startId + 5}"]`).firstChild ||
                startId + 7 === targetId && !document.querySelector(`[square-id="${startId + 1}"]`).firstChild && !document.querySelector(`[square-id="${startId + 2}"]`).firstChild && !document.querySelector(`[square-id="${startId + 3}"]`).firstChild && !document.querySelector(`[square-id="${startId + 4}"]`).firstChild && !document.querySelector(`[square-id="${startId + 5}"]`).firstChild && !document.querySelector(`[square-id="${startId + 6}"]`).firstChild ||

                // moving right side straight
                startId - 1 === targetId ||
                startId - 2 === targetId && !document.querySelector(`[square-id="${startId - 1}"]`).firstChild ||
                startId - 3 === targetId && !document.querySelector(`[square-id="${startId - 1}"]`).firstChild && !document.querySelector(`[square-id="${startId - 2}"]`).firstChild ||
                startId - 4 === targetId && !document.querySelector(`[square-id="${startId - 1}"]`).firstChild && !document.querySelector(`[square-id="${startId - 2}"]`).firstChild && !document.querySelector(`[square-id="${startId - 3}"]`).firstChild ||
                startId - 5 === targetId && !document.querySelector(`[square-id="${startId - 1}"]`).firstChild && !document.querySelector(`[square-id="${startId - 2}"]`).firstChild && !document.querySelector(`[square-id="${startId - 3}"]`).firstChild && !document.querySelector(`[square-id="${startId - 4}"]`).firstChild ||
                startId - 6 === targetId && !document.querySelector(`[square-id="${startId - 1}"]`).firstChild && !document.querySelector(`[square-id="${startId - 2}"]`).firstChild && !document.querySelector(`[square-id="${startId - 3}"]`).firstChild && !document.querySelector(`[square-id="${startId - 4}"]`).firstChild && !document.querySelector(`[square-id="${startId - 5}"]`).firstChild ||
                startId - 7 === targetId && !document.querySelector(`[square-id="${startId - 1}"]`).firstChild && !document.querySelector(`[square-id="${startId - 2}"]`).firstChild && !document.querySelector(`[square-id="${startId - 3}"]`).firstChild && !document.querySelector(`[square-id="${startId - 4}"]`).firstChild && !document.querySelector(`[square-id="${startId - 5}"]`).firstChild && !document.querySelector(`[square-id="${startId - 6}"]`).firstChild
            ) {
                return true
            }
            break;

        case 'queen':
            if (
                // for right cross --- forward
                startId + width + 1 === targetId ||
                startId + width * 2 + 2 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild ||
                startId + width * 3 + 3 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild ||
                startId + width * 4 + 4 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 + 3}"]`).firstChild ||
                startId + width * 5 + 5 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 + 4}"]`).firstChild ||
                startId + width * 6 + 6 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 + 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 5 + 5}"]`).firstChild ||
                startId + width * 7 + 7 === targetId && !document.querySelector(`[square-id = "${startId + width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 + 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 5 + 5}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 6 + 6}"]`).firstChild ||

                // for left cross --- forward
                startId + width - 1 === targetId ||
                startId + width * 2 - 2 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild ||
                startId + width * 3 - 3 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild ||
                startId + width * 4 - 4 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 - 3}"]`).firstChild ||
                startId + width * 5 - 5 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 - 4}"]`).firstChild ||
                startId + width * 6 - 6 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 - 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 5 - 5}"]`).firstChild ||
                startId + width * 7 - 7 === targetId && !document.querySelector(`[square-id = "${startId + width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 4 - 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 5 - 5}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 6 - 6}"]`).firstChild ||

                // for right cross --- backward
                startId - width - 1 === targetId ||
                startId - width * 2 - 2 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild ||
                startId - width * 3 - 3 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild ||
                startId - width * 4 - 4 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 - 3}"]`).firstChild ||
                startId - width * 5 - 5 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 - 4}"]`).firstChild ||
                startId - width * 6 - 6 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 - 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 5 - 5}"]`).firstChild ||
                startId - width * 7 - 7 === targetId && !document.querySelector(`[square-id = "${startId - width - 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 - 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 - 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 - 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 5 - 5}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 6 - 6}"]`).firstChild ||

                // fot left cross -- backward
                startId - width + 1 === targetId ||
                startId - width * 2 + 2 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild ||
                startId - width * 3 + 3 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild ||
                startId - width * 4 + 4 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 + 3}"]`).firstChild ||
                startId - width * 5 + 5 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 + 4}"]`).firstChild ||
                startId - width * 6 + 6 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 + 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 5 + 5}"]`).firstChild ||
                startId - width * 7 + 7 === targetId && !document.querySelector(`[square-id = "${startId - width + 1}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 2 + 2}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 3 + 3}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 4 + 4}"]`).firstChild && !document.querySelector(`[square-id = "${startId - width * 5 + 5}"]`).firstChild && !document.querySelector(`[square-id = "${startId + width * 6 + 6}"]`).firstChild
            ) {
                return true;
            }
            break;
            
        case 'king':
            // King can move one square in any direction
            if (
                // Horizontal moves
                startId + 1 === targetId || 
                startId - 1 === targetId ||
                // Vertical moves
                startId + width === targetId ||
                startId - width === targetId ||
                // Diagonal moves
                startId + width + 1 === targetId ||
                startId + width - 1 === targetId ||
                startId - width + 1 === targetId ||
                startId - width - 1 === targetId
            ) {
                return true;
            }
            return false;
    }
}

function highlight_move(piece, squareId) {
    console.log(`Highlighting possible moves for ${piece} at ${squareId}`);
    
    // Clear any existing highlights first
    clear_highlights();
    
    // If no piece or square ID, just return
    if (!piece || !squareId) return;
    
    // Convert squareId to number to ensure proper comparisons
    const startId = Number(squareId);
    
    // Highlight all squares that would be valid moves
    document.querySelectorAll('.square').forEach(square => {
        const targetId = Number(square.getAttribute('square-id'));
        
        // Skip the current square
        if (targetId === startId) return;
        
        // Create a dummy target for check_valid
        const dummyTarget = {
            getAttribute: () => targetId,
            parentNode: { getAttribute: () => targetId }
        };
        
        // Check if this move would be valid
        if (check_valid(dummyTarget)) {
            square.classList.add('highlight');
        }
    });
}

function clear_highlights() {
    console.log('Clearing all highlights');
    document.querySelectorAll('.square.highlight').forEach(square => {
        square.classList.remove('highlight');
    });
}

function reverseIds() {
    console.log('Reversing board IDs for white perspective');
    // This function maintains the standard board orientation (white at bottom)
    // No need to change square IDs as this is the default orientation
}

function revertIds() {
    console.log('Reverting board IDs for black perspective');
    // This function would flip the visual representation for black player
    // In a more complete implementation, this would visually rotate the board
}

// Add the missing animateMove function
async function animateMove(piece, targetSquare) {
    if (!piece || !targetSquare) return;
    
    // Add animation class to the piece
    piece.classList.add('moving');
    
    // Highlight the square being moved to
    targetSquare.classList.add('highlighted');
    
    // If there's a piece being captured, animate it
    const capturedPiece = targetSquare.querySelector('.piece');
    if (capturedPiece && capturedPiece !== piece) {
        capturedPiece.classList.add('captured');
        // Wait for capture animation to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        // Remove the captured piece
        capturedPiece.remove();
    }
    
    // Return a promise that resolves when animation is complete
    return new Promise(resolve => {
        setTimeout(() => {
            // Remove animation classes after animation completes
            piece.classList.remove('moving');
            setTimeout(() => {
                targetSquare.classList.remove('highlighted');
                resolve();
            }, 300);
        }, 200);
    });
}

// Add function to check for win conditions
function check_win() {
    // This is a simple implementation that could be expanded
    // Check if king is captured, etc.
    console.log('Checking for win conditions');
    
    // For now, we'll just check if there are no pieces of one color left
    const whitePieces = document.querySelectorAll('.piece .white');
    const blackPieces = document.querySelectorAll('.piece .black');
    
    if (whitePieces.length === 0) {
        info_display.textContent = 'Black wins!';
        return true;
    }
    
    if (blackPieces.length === 0) {
        info_display.textContent = 'White wins!';
        return true;
    }
    
    return false;
}

// Function to handle receiving opponent's move in multiplayer mode
function handleOpponentMove(moveData) {
    if (!moveData) return;
    
    const { from, to, piece } = moveData;
    
    // Find the piece element
    const pieceElement = document.querySelector(`#${piece}`);
    if (!pieceElement) {
        console.error(`Piece with id ${piece} not found`);
        return;
    }
    
    // Find the source and target squares
    const sourceSquare = document.querySelector(`[square-id="${from}"]`);
    const targetSquare = document.querySelector(`[square-id="${to}"]`);
    
    if (!sourceSquare || !targetSquare) {
        console.error(`Source or target square not found`, from, to);
        return;
    }
    
    // Perform the move
    animateMove(pieceElement, targetSquare)
        .then(() => {
            targetSquare.append(pieceElement);
            check_win();
            change_player();
        });
}