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
      fileName: req.file.originalname,
      transcriptionText
    });

    const saved = await doc.save();

    return res.status(200).json({ success: true, transcription: saved });
  } catch (error) {
    console.error("Detailed AssemblyAI Error:", error.message || error);
    return res.status(500).json({ 
      success: false, 
      message: 'Transcription failed', 
      error: error.message || "Internal Server Error" 
    });
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
