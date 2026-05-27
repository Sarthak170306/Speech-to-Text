import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [history, setHistory] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [language, setLanguage] = useState('en');

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  // Fetch History from API
  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/history');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setHistory(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Start Audio Recording using MediaRecorder API
  const startRecording = async () => {
    try {
      setTranscription('');
      setRecordingBlob(null);
      setRecordingUrl(null);
      setSelectedFile(null);
      audioChunksRef.current = [];

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Microphone access is not supported by your browser or connection. Please use a secure origin (localhost or HTTPS).');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        setRecordingBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
        // Automatically call the translation function when recording stops
        handleTranslate(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      alert('Could not access microphone: ' + err.message);
    }
  };

  // Stop Audio Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  // Handle File Upload from Input
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setRecordingBlob(null);
      setRecordingUrl(null);
      setTranscription('');
      // Auto-submit selected file
      handleTranslate(file);
    }
  };

  // POST Audio to Backend API
  const handleTranslate = async (audioSource) => {
    const fileOrBlob = audioSource || recordingBlob;
    if (!fileOrBlob) {
      alert('Please select a file or record audio first.');
      return;
    }

    setLoading(true);
    setTranscription('');

    try {
      const formData = new FormData();
      if (fileOrBlob instanceof Blob && !(fileOrBlob instanceof File)) {
        formData.append('audio', fileOrBlob, 'recording.mp3');
      } else {
        formData.append('audio', fileOrBlob);
      }
      formData.append('language', language);

      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed. Backend error.');
      }

      const result = await response.json();
      if (result.success) {
        const text = result.transcription?.transcriptionText || result.transcription || 'No text transcribed.';
        setTranscription(text);
        fetchHistory(); // Refresh translation history
      } else {
        setTranscription('Failed: ' + (result.message || 'Transcription error.'));
      }
    } catch (error) {
      console.error('Translation error:', error);
      setTranscription('Error connecting to backend server. Make sure http://localhost:5000 is running.');
    } finally {
      setLoading(false);
    }
  };

  // Copy to Clipboard helper
  const copyToClipboard = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.2),rgba(255,255,255,0))] text-slate-100 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Container */}
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Header Section */}
        <div className="text-center space-y-2">
          
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
            AI Voice Transcriber
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto">
            Record voice notes or upload audio files to convert them to text using high-fidelity AI transcription.
          </p>
        </div>

        {/* Central Dashboard Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-950/50 space-y-8">
          
          {/* Language Selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138A8.277 8.277 0 0 1 12 9" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-200">Transcription Language</p>
                <p className="text-[11px] text-slate-500">Choose the language you are speaking in</p>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full sm:w-48 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              <option value="en">English (US/UK)</option>
              <option value="hi">Hindi (हिन्दी)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            
            {/* Left Side: Voice Recorder */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              {/* Mic Status Ring */}
              <div className="relative mb-6">
                <div className={`absolute -inset-4 rounded-full blur-xl transition-all duration-500 ${isRecording ? 'bg-red-500/30 animate-pulse' : 'bg-indigo-500/10'}`}></div>
                <div className={`w-20 h-20 rounded-full flex items-center justify-center border transition-all duration-300 ${isRecording ? 'bg-red-500/10 border-red-500 text-red-500 scale-110 shadow-lg shadow-red-500/20' : 'bg-slate-900 border-slate-800 text-indigo-400 hover:border-indigo-500/50'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </div>
                {isRecording && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                  </span>
                )}
              </div>

              <h3 className="text-lg font-semibold text-slate-200 mb-1">Record Voice Note</h3>
              <p className="text-xs text-slate-500 mb-6">Capture audio directly from your microphone</p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${
                    isRecording
                      ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-500/25'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-500/25'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full bg-white pointer-events-none ${isRecording ? 'animate-ping' : 'animate-pulse'}`}></span>
                  <span className="pointer-events-none">{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                </button>
              </div>

              {recordingUrl && !isRecording && (
                <div className="mt-4 w-full bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">Recording Preview</p>
                  <audio src={recordingUrl} controls className="w-full h-8 custom-audio" />
                </div>
              )}
            </div>

            {/* Right Side: File Upload */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              <div className="mb-6 w-20 h-20 rounded-full flex items-center justify-center bg-slate-900 border border-slate-800 text-indigo-400 group-hover:border-indigo-500/50 transition-all duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>

              <h3 className="text-lg font-semibold text-slate-200 mb-1">Upload Audio File</h3>
              <p className="text-xs text-slate-500 mb-6">Supported formats: .mp3, .wav, .m4a</p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                onClick={() => fileInputRef.current.click()}
                className="px-6 py-2.5 rounded-xl font-semibold text-sm border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all active:scale-[0.98]"
              >
                Choose File
              </button>

              {selectedFile && (
                <div className="mt-4 px-4 py-2 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-300 max-w-full truncate font-mono">
                  {selectedFile.name}
                </div>
              )}
            </div>

          </div>

          {/* Results Area */}
          <div className="border-t border-slate-800/80 pt-8 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-indigo-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v5.27Z" />
                </svg>
                Live Transcription Result
              </h2>

              {transcription && (
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/40 text-xs font-semibold text-slate-400 hover:text-white transition-all active:scale-[0.97]"
                >
                  {copySuccess ? 'Copied!' : 'Copy Text'}
                </button>
              )}
            </div>

            <div className="relative min-h-[140px] rounded-2xl bg-slate-950/80 border border-slate-800/80 p-5 font-mono text-sm leading-relaxed text-slate-300">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                  {/* Premium Spinner */}
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-r-transparent border-indigo-500 animate-spin"></div>
                  </div>
                  <p className="text-xs text-indigo-400 animate-pulse font-medium">Transcribing your audio... ✨</p>
                </div>
              ) : transcription ? (
                <p className="whitespace-pre-wrap">{transcription}</p>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-center py-8 font-sans">
                  No transcription yet. Try recording audio or uploading a file above.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Translation History Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            Transcription History
          </h2>

          {history.length === 0 ? (
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl py-12 text-center text-slate-500 text-sm">
              Your transcription history is currently empty.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((item) => (
                <div
                  key={item._id}
                  className="bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/60 hover:border-slate-700/60 rounded-2xl p-5 shadow-lg shadow-slate-950/20 transition-all duration-300 group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 max-w-[70%]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-indigo-400 shrink-0">
                          <path d="M10 3.75a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM17.25 4.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 .75-.75ZM17.25 7.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 .75-.75ZM17.25 10.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 .75-.75ZM17.25 13.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 .75-.75ZM17.25 16.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 .75-.75ZM2.75 4.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75ZM2.75 7.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75ZM2.75 10.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75ZM2.75 13.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75ZM2.75 16.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75ZM10 14.75a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM12 9.25a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 14.75a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                        </svg>
                        <span className="text-xs font-semibold text-slate-300 truncate font-mono" title={item.fileName}>
                          {item.fileName}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed font-sans select-all">
                      {item.transcriptionText}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between">
                    <span className="text-[10px] text-indigo-400/70 font-semibold uppercase tracking-wider">MERN + AssemblyAI</span>
                    <button
                      onClick={() => setTranscription(item.transcriptionText)}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-all"
                    >
                      View Full
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;


