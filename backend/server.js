import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import multer from 'multer';
import { AssemblyAI } from 'assemblyai';
import Transcription from './models/Transcription.js';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 5000;

// Initialize AssemblyAI client
if (!process.env.ASSEMBLYAI_API_KEY) {
  console.warn('Warning: ASSEMBLYAI_API_KEY is not set in .env. Transcription calls will fail until it is provided.');
}
const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Speech to Text backend is running' });
});

// Upload and transcribe endpoint
app.post('/api/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file uploaded' });
    }

    const filePath = req.file.path; // local path provided by multer

    // Send the local file to AssemblyAI for transcription
    const transcriptResponse = await client.transcripts.transcribe({ audio: filePath });

    // Extract text from the AssemblyAI response
    const transcriptionText = transcriptResponse && transcriptResponse.text ? transcriptResponse.text : '';

    // Save transcription to MongoDB
    const doc = new Transcription({
      fileName: req.file.originalname,
      transcriptionText
    });

    const saved = await doc.save();

    return res.status(200).json({ success: true, transcription: saved });
  } catch (error) {
    console.error('Transcription or save error:', error);
    return res.status(500).json({ success: false, message: 'Transcription failed', error: error.message });
  }
});

// History route: returns previous transcriptions sorted by newest first
app.get('/api/history', async (req, res) => {
  try {
    const items = await Transcription.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch history', error: error.message });
  }
});

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI must be defined in .env');
    }

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

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
