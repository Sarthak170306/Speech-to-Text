import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
  useAuth,
} from '@clerk/clerk-react';
import { API_BASE } from './lib/api.js';

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))] text-slate-100 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-blue-500/10 blur-[80px] pointer-events-none"></div>

      <div className="w-full max-w-lg rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-10 text-center shadow-2xl shadow-indigo-500/5 space-y-8 relative z-10 transition-all duration-500 hover:border-slate-700/80">
        {/* Glow-enhanced AI Icon */}
        <div className="relative mx-auto w-24 h-24 mb-2">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl blur-xl opacity-40 animate-pulse"></div>
          <div className="relative w-full h-full bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center text-indigo-400 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
            AI Voice Transcriber
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
            Convert voice recordings and files into high-accuracy text in real-time, powered by deep learning AI models.
          </p>
        </div>

        <div className="pt-4">
          <SignInButton mode="modal">
            <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105 hover:shadow-indigo-500/20 active:scale-95 duration-200">
              Get Started / Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
}

function TranscriberApp() {
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const authFetch = useCallback(
    async (path, options = {}) => {
      const token = await getToken();
      if (!token) {
        throw new Error('Please sign in to continue.');
      }

      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${token}`);

      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    },
    [getToken]
  );

  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [history, setHistory] = useState([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState('');
  const [liveStreaming, setLiveStreaming] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [savingLiveStream, setSavingLiveStream] = useState(false);

  const LIVE_CAPTION_PLACEHOLDER =
    'Live captions will appear here once the stream begins. Speak into the mic and watch the text update in real time.';

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const micStreamRef = useRef(null);
  const liveTranscriptRef = useRef('');

  const fetchHistory = async () => {
    try {
      const response = await authFetch('/api/history');
      const result = await response.json();
      if (response.ok && result.success) {
        setHistory(result.data);
        return true;
      }
      return false;
    } catch (historyError) {
      console.error('Error fetching history:', historyError);
      return false;
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return undefined;
    }

    fetchHistory();
    return () => {
      stopLiveStream();
    };
  }, [isLoaded, isSignedIn]);

  // Start Audio Recording using MediaRecorder API
  const startRecording = async () => {
    try {
      setTranscription('');
      setRecordingBlob(null);
      setRecordingUrl(null);
      setSelectedFile(null);
      setError('');
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
    if (!file) {
      return;
    }

    const isAudioFile =
      (file.type && file.type.startsWith('audio/')) || /\.(mp3|wav|m4a)$/i.test(file.name);

    if (!isAudioFile) {
      setError('Invalid file type. Please upload a valid audio file (mp3, wav, m4a).');
      setSelectedFile(null);
      setRecordingBlob(null);
      setRecordingUrl(null);
      setTranscription('');
      e.target.value = '';
      return;
    }

    setError('');
    setSelectedFile(file);
    setRecordingBlob(null);
    setRecordingUrl(null);
    setTranscription('');
    handleTranslate(file);
  };

  // POST Audio to Backend API
  const handleTranslate = async (audioSource) => {
    const fileOrBlob = audioSource || recordingBlob;
    if (!fileOrBlob) {
      alert('Please select a file or record audio first.');
      return;
    }

    setLoading(true);
    setError('');
    setTranscription('');

    try {
      const formData = new FormData();
      if (fileOrBlob instanceof Blob && !(fileOrBlob instanceof File)) {
        formData.append('audio', fileOrBlob, 'recording.mp3');
      } else {
        formData.append('audio', fileOrBlob);
      }
      formData.append('language', language);

      const response = await authFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Transcription failed. Backend error.');
      }

      if (result.success && result.transcription) {
        const text = result.transcription.transcriptionText || 'No text transcribed.';
        setTranscription(text);
        await fetchHistory();
      } else {
        setError(result.message || 'Transcription error occurred.');
      }
    } catch (translateError) {
      console.error('Translation error:', translateError);
      setError('Error connecting to the backend. Make sure the server is running and you are signed in.');
    } finally {
      setLoading(false);
    }
  };

  const downsampleBuffer = (buffer, rate, outRate) => {
    if (outRate === rate) {
      return buffer;
    }

    const sampleRateRatio = rate / outRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < newLength) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let staticAccum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
        staticAccum += buffer[i];
        count += 1;
      }
      result[offsetResult] = count === 0 ? 0 : staticAccum / count;
      offsetResult += 1;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  };

  const convertFloat32ToInt16 = (buffer) => {
    const l = buffer.length;
    const result = new Int16Array(l);
    for (let i = 0; i < l; i += 1) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return result;
  };

  const encodeAudio = (samples, sampleRate) => {
    const downsampled = downsampleBuffer(samples, sampleRate, 16000);
    return convertFloat32ToInt16(downsampled);
  };

  const streamingLanguage = (code) => (code === 'hi' ? 'multi' : 'en');

  const saveLiveStreamToHistory = async (text) => {
    const response = await authFetch('/api/live-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcriptionText: text }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to save live stream to history');
    }

    return result.transcription;
  };

  const resetLiveCaptionFeed = () => {
    liveTranscriptRef.current = '';
    setLiveText('');
  };

  const stopLiveStream = async ({ saveToHistory = false } = {}) => {
    const transcriptToSave = liveTranscriptRef.current.trim();

    setLiveStreaming(false);

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => null);
      audioContextRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'Terminate' }));
        } catch (err) {
          console.error('Failed to terminate websocket session:', err);
        }
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    if (saveToHistory && transcriptToSave) {
      setSavingLiveStream(true);
      try {
        await saveLiveStreamToHistory(transcriptToSave);
        await fetchHistory();
      } catch (saveError) {
        console.error('Failed to save live stream:', saveError);
        setError(saveError.message || 'Could not save live stream to history.');
      } finally {
        setSavingLiveStream(false);
      }
    }

    resetLiveCaptionFeed();
  };

  const endLiveStream = () => {
    stopLiveStream({ saveToHistory: true });
  };

  const startLiveStream = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Live streaming requires microphone access in a secure browser context.');
      return;
    }

    setError('');
    liveTranscriptRef.current = '';
    setLiveText('Connecting live stream...');

    try {
      const tokenResponse = await authFetch('/api/realtime-token');
      const tokenPayload = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok) {
        throw new Error(
          tokenPayload.message ||
            tokenPayload.details?.error ||
            'Realtime token fetch failed. Check that ASSEMBLYAI_API_KEY is set on the backend.'
        );
      }

      const token = tokenPayload?.token;
      if (!token) {
        throw new Error('Realtime token was not returned from the backend.');
      }

      const streamLang = streamingLanguage(language);
      const speechModel =
        streamLang === 'multi' ? 'universal-streaming-multilingual' : 'universal-streaming-english';
      const wsUrl =
        `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&encoding=pcm_s16le&formatted_finals=true&language=${streamLang}&speech_model=${speechModel}&token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      let committedText = '';

      socket.onopen = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = stream;
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const source = audioContext.createMediaStreamSource(stream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (event) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
              return;
            }
            const inputData = event.inputBuffer.getChannelData(0);
            const pcmChunk = encodeAudio(inputData, audioContext.sampleRate);
            wsRef.current.send(pcmChunk.buffer);
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
          setLiveStreaming(true);
          setLiveText('Live stream started. Speak now and captions will appear below.');
        } catch (micError) {
          console.error('Microphone capture failed for live stream:', micError);
          setError('Unable to access microphone for live streaming.');
          stopLiveStream();
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'Begin') {
            setLiveText('Listening...');
            return;
          }

          if (msg.type === 'Turn') {
            const liveLine = committedText + (msg.transcript || '');
            const trimmedLine = liveLine.trim();
            liveTranscriptRef.current = trimmedLine;
            setLiveText(trimmedLine || 'Listening...');

            if (msg.end_of_turn && msg.transcript) {
              const segment = msg.turn_is_formatted ? msg.transcript : `${msg.transcript}.`;
              committedText += `${segment} `;
              liveTranscriptRef.current = committedText.trim();
            }
            return;
          }

          if (msg.type === 'Termination') {
            setLiveText((prev) => prev || 'Live stream ended.');
          }
        } catch (messageError) {
          console.error('Realtime message parse failed:', messageError);
        }
      };

      socket.onerror = () => {
        setError('Realtime streaming connection failed. Please try again.');
      };

      socket.onclose = (event) => {
        setLiveStreaming(false);
        if (!event.wasClean) {
          setError('Live stream disconnected unexpectedly. Please start again.');
        }
      };
    } catch (streamError) {
      console.error('Realtime stream setup failed:', streamError);
      setError(streamError.message || 'Failed to start live stream.');
      setLiveText('');
      stopLiveStream();
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
        
        {/* Premium Dashboard Welcome Header */}
        <div className="w-full flex items-center justify-between bg-slate-900/40 border border-slate-800/60 rounded-3xl p-4 sm:px-6 backdrop-blur-xl shadow-lg">
          <div className="text-left">
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              Welcome, {user?.firstName || 'User'}! 👋
            </h2>
            <p className="text-[11px] text-slate-400 hidden sm:block">Ready to transcribe your voice notes today?</p>
          </div>
          <div className="flex items-center gap-4">
            <UserButton 
              afterSignOutUrl="/" 
              appearance={{ 
                elements: { 
                  avatarBox: 'w-10 h-10 border-2 border-indigo-500/40 hover:border-indigo-500/80 transition-all' 
                } 
              }} 
            />
          </div>
        </div>
        
        {/* Header Section */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
            AI Voice Transcriber
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto">
            Record voice notes or upload audio files to convert them to text using high-fidelity AI transcription.
          </p>
        </div>

        {error && (
          <div className="relative rounded-3xl border border-red-500/40 bg-red-500/10 p-4 text-red-100 shadow-lg shadow-red-900/20">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <div className="rounded-full bg-red-600/20 p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-200">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.25-4.75a.75.75 0 011.5 0v.75a.75.75 0 01-1.5 0v-.75zm0-6.5a.75.75 0 011.5 0v4.75a.75.75 0 01-1.5 0V6.75z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-100">Notification</p>
                <p className="mt-1 text-sm text-red-200 leading-6">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-200 hover:text-white transition-colors rounded-full p-1"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

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

          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/50 p-6 shadow-xl shadow-slate-950/10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-indigo-300 font-semibold">Live Captions</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-100">🔥 Live Captions (Real-time Stream)</h3>
                <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                  Stream your mic audio directly to AssemblyAI and display live captions like a YouTube subtitle experience.
                </p>
              </div>
              <button
                onClick={liveStreaming ? endLiveStream : startLiveStream}
                disabled={savingLiveStream}
                className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${liveStreaming ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
              >
                {savingLiveStream ? 'Saving...' : liveStreaming ? 'Stop Live Stream' : 'Start Live Stream'}
              </button>
            </div>
            <div className="mt-6 rounded-[2rem] border border-indigo-500/20 bg-slate-900/90 p-6 min-h-[170px] shadow-[0_0_40px_rgba(99,102,241,0.15)]">
              <p className="text-xs uppercase tracking-[0.24em] text-indigo-300 mb-3">Live caption feed</p>
              <div className="min-h-[100px] rounded-3xl border border-indigo-500/15 bg-slate-950/80 p-4 text-slate-100 text-sm leading-7 whitespace-pre-wrap break-words shadow-inner shadow-slate-950/10">
                {liveText ? liveText : LIVE_CAPTION_PLACEHOLDER}
              </div>
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
              No past transcriptions yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((item) => (
                <div
                  key={item._id}
                  className="bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/60 hover:border-slate-700/60 rounded-2xl p-5 shadow-lg shadow-slate-950/20 transition-all duration-300 group flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs uppercase tracking-[0.18em] text-indigo-300 font-semibold">File</p>
                        <p className="text-sm font-semibold text-slate-100 truncate" title={item.fileName}>{item.fileName}</p>
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-slate-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown time'}
                      </span>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 border border-slate-800/70 p-4">
                      <p className="text-sm text-slate-300 leading-6 whitespace-pre-wrap break-words">
                        {item.transcriptionText}
                      </p>
                    </div>
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

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <TranscriberApp />
      </SignedIn>
    </div>
  );
}
