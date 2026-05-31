import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import multer from 'multer';
import fs from 'fs/promises';
import { clerkMiddleware, getAuth, requireAuth } from '@clerk/express';
import { AssemblyAI } from 'assemblyai';
import Transcription from './models/Transcription.js';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (!process.env.CLERK_SECRET_KEY) {
  console.warn('Warning: CLERK_SECRET_KEY is not set in .env. Protected API routes will fail until it is provided.');
}

// Initialize AssemblyAI client
if (!process.env.ASSEMBLYAI_API_KEY) {
  console.warn('Warning: ASSEMBLYAI_API_KEY is not set in .env. Transcription calls will fail until it is provided.');
}
const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(clerkMiddleware());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Speech to Text backend is running' });
});

// Upload and transcribe endpoint
app.post('/api/upload', requireAuth(), upload.single('audio'), async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!req.file) {
      console.log("No audio file found in request.");
      return res.status(400).json({ success: false, message: 'No audio file uploaded' });
    }

    // Safer path handling for Windows systems
    const resolvedPath = req.file.path.replace(/\\/g, '/');
    
    // Log file details for debugging
    console.log("Received file name:", req.file.originalname);
    console.log("Received file size:", req.file.size);
    console.log("Resolved local file path:", resolvedPath);

    // Extract language code from request body (default to English 'en')
    const languageCode = req.body.language || 'en';
    console.log("Selected transcription language:", languageCode);

    // Send the local file to AssemblyAI for transcription
    const transcriptResponse = await client.transcripts.transcribe({
      audio: resolvedPath,
      speech_models: ["universal-3-pro", "universal-2"],
      language_code: languageCode
    });

    // Extract text from the AssemblyAI response
    const transcriptionText = transcriptResponse && transcriptResponse.text ? transcriptResponse.text : '';

    // Save transcription to MongoDB
    const doc = new Transcription({
      userId,
      fileName: req.file.originalname,
      transcriptionText
    });

    const saved = await doc.save();

    try {
      await fs.unlink(resolvedPath);
    } catch (unlinkError) {
      console.warn('Could not remove uploaded temp file:', unlinkError.message);
    }

    return res.status(200).json({
      success: true,
      transcription: saved,
      savedToHistory: true,
    });
  } catch (error) {
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('Could not remove uploaded temp file:', unlinkError.message);
      }
    }

    console.error("Detailed AssemblyAI Error:", error.message || error);
    return res.status(500).json({ 
      success: false, 
      message: 'Transcription failed', 
      error: error.message || "Internal Server Error" 
    });
  }
});

// Save completed live stream transcription to history
app.post('/api/live-stream', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const { transcriptionText } = req.body;

    if (!transcriptionText || !String(transcriptionText).trim()) {
      return res.status(400).json({ success: false, message: 'No live stream text to save' });
    }

    const savedAt = new Date();
    const fileName = `Live Stream — ${savedAt.toLocaleString()}`;

    const doc = new Transcription({
      userId,
      fileName,
      transcriptionText: String(transcriptionText).trim(),
    });

    const saved = await doc.save();

    return res.status(200).json({ success: true, transcription: saved });
  } catch (error) {
    console.error('Error saving live stream:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save live stream to history',
      error: error.message,
    });
  }
});

// History route: returns previous transcriptions sorted by newest first
app.get('/api/history', requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const items = await Transcription.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch history', error: error.message });
  }
});

// Delete a specific history item
app.delete('/api/history/:id', requireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Transcription.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'History item not found' });
    }
    return res.status(200).json({ success: true, message: 'History item deleted successfully' });
  } catch (error) {
    console.error('Error deleting history item:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete history item', error: error.message });
  }
});

app.get('/api/realtime-token', requireAuth(), async (req, res) => {
  try {
    if (!process.env.ASSEMBLYAI_API_KEY) {
      return res.status(500).json({ message: 'ASSEMBLYAI_API_KEY is not configured on the server' });
    }

    const expiresIn = 60;
    const response = await fetch(
      `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresIn}`,
      {
        method: 'GET',
        headers: {
          authorization: process.env.ASSEMBLYAI_API_KEY,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('AssemblyAI token request failed:', data);
      return res.status(response.status).json({
        message: 'Failed to fetch realtime token from AssemblyAI',
        details: data,
      });
    }

    if (!data?.token) {
      console.error('AssemblyAI token missing in response:', data);
      return res.status(500).json({ message: 'Realtime token missing in AssemblyAI response', details: data });
    }

    return res.json({ token: data.token });
  } catch (error) {
    console.error('Realtime token fetch failed:', error);
    return res.status(500).json({ message: 'Error fetching realtime token', error: error.message });
  }
});

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI must be defined in .env');
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log('Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Startup error:', error.message);
    process.exit(1);
  }
}

startServer();
