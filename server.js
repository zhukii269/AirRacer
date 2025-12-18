/**
 * AirRacer Multiplayer Server
 * WebSocket server for LAN-based 2-player racing
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

// Store active rooms
const rooms = new Map();

// Generate 6-digit room code
function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`[Server] WebSocket server running on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('[Server] New client connected');

    ws.playerId = null;
    ws.roomCode = null;
    ws.isReady = false;

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            handleMessage(ws, msg);
        } catch (e) {
            console.error('[Server] Invalid message:', e);
        }
    });

    ws.on('close', () => {
        console.log('[Server] Client disconnected');
        handleDisconnect(ws);
    });

    ws.on('error', (err) => {
        console.error('[Server] WebSocket error:', err);
    });
});

function handleMessage(ws, msg) {
    switch (msg.type) {
        case 'create_room':
            handleCreateRoom(ws);
            break;
        case 'join_room':
            handleJoinRoom(ws, msg.roomCode);
            break;
        case 'ready':
            handleReady(ws);
            break;
        case 'state':
            handleState(ws, msg);
            break;
        case 'finish':
            handleFinish(ws, msg);
            break;
    }
}

function handleCreateRoom(ws) {
    const roomCode = generateRoomCode();
    rooms.set(roomCode, {
        players: [ws],
        state: 'waiting', // waiting, countdown, racing, finished
        startTime: null
    });

    ws.playerId = 1;
    ws.roomCode = roomCode;

    ws.send(JSON.stringify({
        type: 'room_created',
        roomCode: roomCode,
        playerId: 1
    }));

    console.log(`[Server] Room ${roomCode} created by player 1`);
}

function handleJoinRoom(ws, roomCode) {
    const room = rooms.get(roomCode);

    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '房间不存在'
        }));
        return;
    }

    if (room.players.length >= 2) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '房间已满'
        }));
        return;
    }

    room.players.push(ws);
    ws.playerId = 2;
    ws.roomCode = roomCode;

    ws.send(JSON.stringify({
        type: 'room_joined',
        roomCode: roomCode,
        playerId: 2
    }));

    // Notify player 1 that player 2 joined
    room.players[0].send(JSON.stringify({
        type: 'opponent_joined'
    }));

    console.log(`[Server] Player 2 joined room ${roomCode}`);
}

function handleReady(ws) {
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    ws.isReady = true;
    console.log(`[Server] Player ${ws.playerId} ready in room ${ws.roomCode}`);

    // Check if both players are ready
    const allReady = room.players.length === 2 &&
        room.players.every(p => p.isReady);

    if (allReady) {
        room.state = 'countdown';

        // Start countdown for both players
        room.players.forEach(p => {
            p.send(JSON.stringify({
                type: 'countdown_start'
            }));
        });

        console.log(`[Server] Room ${ws.roomCode} starting countdown`);

        // After countdown, start race
        setTimeout(() => {
            room.state = 'racing';
            room.startTime = Date.now();

            room.players.forEach(p => {
                p.send(JSON.stringify({
                    type: 'race_start',
                    startTime: room.startTime
                }));
            });

            console.log(`[Server] Room ${ws.roomCode} race started`);
        }, 5500); // 5.5 seconds for countdown (matches game countdown)
    }
}

function handleState(ws, msg) {
    const room = rooms.get(ws.roomCode);
    if (!room || room.state !== 'racing') return;

    // Broadcast state to opponent
    room.players.forEach(p => {
        if (p !== ws && p.readyState === WebSocket.OPEN) {
            p.send(JSON.stringify({
                type: 'opponent_state',
                position: msg.position,
                quaternion: msg.quaternion,
                speed: msg.speed
            }));
        }
    });
}

function handleFinish(ws, msg) {
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    // Mark this player as finished
    ws.finishTime = msg.time;
    ws.finished = true;

    console.log(`[Server] Player ${ws.playerId} finished in ${msg.time}ms`);

    // Check if both finished or determine winner
    const finishedPlayers = room.players.filter(p => p.finished);

    if (finishedPlayers.length === 1) {
        // First to finish - notify opponent
        room.players.forEach(p => {
            if (p !== ws) {
                p.send(JSON.stringify({
                    type: 'opponent_finished',
                    time: msg.time
                }));
            }
        });
    }

    if (finishedPlayers.length === 2 || room.players.length === 1) {
        // Both finished - determine winner
        room.state = 'finished';

        const winner = room.players.reduce((a, b) =>
            (a.finishTime || Infinity) < (b.finishTime || Infinity) ? a : b
        );

        room.players.forEach(p => {
            p.send(JSON.stringify({
                type: 'race_result',
                winner: winner.playerId,
                yourTime: p.finishTime,
                opponentTime: room.players.find(x => x !== p)?.finishTime
            }));
        });

        console.log(`[Server] Room ${ws.roomCode} race ended, winner: player ${winner.playerId}`);
    }
}

function handleDisconnect(ws) {
    if (!ws.roomCode) return;

    const room = rooms.get(ws.roomCode);
    if (!room) return;

    // Notify other player
    room.players.forEach(p => {
        if (p !== ws && p.readyState === WebSocket.OPEN) {
            p.send(JSON.stringify({
                type: 'opponent_disconnected'
            }));
        }
    });

    // Remove player from room
    room.players = room.players.filter(p => p !== ws);

    // Delete room if empty
    if (room.players.length === 0) {
        rooms.delete(ws.roomCode);
        console.log(`[Server] Room ${ws.roomCode} deleted`);
    }
}

// Handle server shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    wss.close(() => {
        console.log('[Server] Closed');
        process.exit(0);
    });
});
