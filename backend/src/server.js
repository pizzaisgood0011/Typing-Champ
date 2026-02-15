import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Score } from '../models/Score.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "http://localhost:5173" } });

app.use(cors());
app.use(express.json());

const URI = process.env.MongoDB || "mongodb://127.0.0.1:27017/your_db_name";
mongoose.connect(URI).then(() => console.log("MongoDB Connected"));

app.get('/api/leaderboard', async (req, res) => {
    try {
        const scores = await Score.find().sort({ wpm: -1 }).limit(10);
        res.json(scores);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/scores', async (req, res) => {
    try {
        const newScore = new Score(req.body);
        await newScore.save();
        res.status(201).json(newScore);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

let waitingPlayers = [];
let roomStates = {};

const GAME_TEXT = "The quick brown fox jumps over the lazy dog and runs away from the hunter.";

io.on('connection', (socket) => {
    socket.on('join_queue', (username) => {
        const isTaken = waitingPlayers.some(p => p.username.toLowerCase() === username.toLowerCase());
        if (isTaken) return socket.emit('queue_error', "Name already in queue.");

        const player = { id: socket.id, username, progress: 0, isReady: false };
        waitingPlayers.push(player);

        if (waitingPlayers.length >= 2) {
            const p1 = waitingPlayers.shift();
            const p2 = waitingPlayers.shift();
            const roomID = `room_${Date.now()}`;

            roomStates[roomID] = {
                players: [{ ...p1, isReady: false }, { ...p2, isReady: false }],
                gameStarted: false,
                countdownStarted: false,
                winner: null
            };

            const s1 = io.sockets.sockets.get(p1.id);
            const s2 = io.sockets.sockets.get(p2.id);
            if (s1) s1.join(roomID);
            if (s2) s2.join(roomID);

            io.to(roomID).emit('match_found', { roomID, players: roomStates[roomID].players });
        }
    });

    socket.on('toggle_ready', ({ roomID }) => {
        const room = roomStates[roomID];
        if (!room || room.countdownStarted) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) player.isReady = !player.isReady;

        io.to(roomID).emit('lobby_update', { players: room.players });

        if (room.players.every(p => p.isReady) && !room.countdownStarted) {
            room.countdownStarted = true;
            io.to(roomID).emit('start_countdown');
            setTimeout(() => {
                room.gameStarted = true;
                io.to(roomID).emit('start_game', { text: GAME_TEXT });
            }, 4000);
        }
    });

    socket.on('update_progress', ({ roomID, progress }) => {
        const room = roomStates[roomID];
        if (!room || !room.gameStarted) return;

        io.to(roomID).emit('player_progress', { id: socket.id, progress });

        if (progress >= 100 && !room.winner) {
            room.winner = socket.id;
            io.to(roomID).emit('game_finished', { winnerID: socket.id });
        }
    });

    socket.on('leave_room', ({ roomID }) => {
        socket.to(roomID).emit('opponent_left');
        socket.leave(roomID);
        delete roomStates[roomID];
    });

    socket.on('send_message', ({ roomID, message, username }) => {
        io.to(roomID).emit('receive_message', { username, message });
    });

    socket.on('disconnect', () => {
        waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);
        
        for (const roomID in roomStates) {
            if (roomStates[roomID].players.some(p => p.id === socket.id)) {
                socket.to(roomID).emit('opponent_left');
                delete roomStates[roomID];
            }
        }
    });
});

httpServer.listen(4000, () => console.log(`Server: http://localhost:4000`));
