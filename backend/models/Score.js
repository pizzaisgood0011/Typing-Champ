import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema({
    username: { type: String, required: true },
    wpm: { type: Number, required: true },
    accuracy: { type: Number, default: 100 },
    lang: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

export const Score = mongoose.model('Score', scoreSchema);