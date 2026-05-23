import mongoose from 'mongoose';

const transcriptionSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  transcriptionText: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Transcription = mongoose.model('Transcription', transcriptionSchema);
export default Transcription;
