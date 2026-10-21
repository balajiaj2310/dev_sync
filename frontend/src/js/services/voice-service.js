/**
 * DevSync Voice AI Service
 * Real-time bidirectional Voice-to-Voice streaming using Google Gemini Live API
 * with Ephemeral Token authentication, Web Audio API PCM capture/playback,
 * and resilient REST TTS fallback.
 */

export class DevSyncVoiceService {
  constructor(options = {}) {
    this.options = {
      tokenEndpoint: '/api/v1/ai/voice/token',
      contextEndpoint: '/api/v1/ai/voice/context',
      synthesizeEndpoint: '/api/v1/ai/voice/synthesize',
      activeRepo: options.activeRepo || 'devsync-core',
      activeBranch: options.activeBranch || 'main',
      voiceName: options.voiceName || 'Puck',
      language: options.language || 'en-US',
      ...options
    };

    // State
    this.state = 'idle'; // idle | requesting_mic | connecting | connected | listening | thinking | speaking | muted | interrupted | error | ended
    this.isMuted = false;
    this.sessionTimer = null;
    this.sessionSeconds = 0;
    this.ephemeralToken = null;
    this.systemInstruction = null;

    // WebSockets & Web Audio
    this.ws = null;
    this.micStream = null;
    this.inputAudioCtx = null;
    this.inputProcessor = null;
    this.inputAnalyser = null;
    this.outputAudioCtx = null;
    this.scheduledAudioTime = 0;
    this.activeAudioSources = [];

    // Speech Recognition & Processing Lock
    this.speechRecognizer = null;
    this.isProcessingSpeech = false;
    this.fallbackRecognition = null;
    this.isFallbackMode = false;

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onAudioLevel = options.onAudioLevel || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onError = options.onError || (() => {});
    this.onTimerTick = options.onTimerTick || (() => {});
  }

  setState(newState, detail = '') {
    this.state = newState;
    this.onStateChange(this.state, detail);
  }

  setMute(muted) {
    this.isMuted = muted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
    }
    this.setState(this.isMuted ? 'muted' : (this.ws && this.ws.readyState === WebSocket.OPEN ? 'listening' : this.state));
  }

  async ensureAudioOutputContext() {
    if (!this.outputAudioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });
        if (this.outputAudioCtx.state === 'suspended') {
          await this.outputAudioCtx.resume();
        }
        this.scheduledAudioTime = this.outputAudioCtx.currentTime;
      }
    }
  }

  async startSession() {
    if (this.state !== 'idle' && this.state !== 'ended') {
      return;
    }

    try {
      this.setState('requesting_mic');

      // 1. Request microphone access for audio levels & orb reactivity
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          // Setup AudioContext & Analyser for reactive Voice Orb & soundwaves
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            this.inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
            if (this.inputAudioCtx.state === 'suspended') {
              await this.inputAudioCtx.resume();
            }

            const micSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);
            this.inputAnalyser = this.inputAudioCtx.createAnalyser();
            this.inputAnalyser.fftSize = 256;

            this.inputProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);
            micSource.connect(this.inputAnalyser);
            this.inputAnalyser.connect(this.inputProcessor);
            this.inputProcessor.connect(this.inputAudioCtx.destination);

            this.bindMicrophoneStreaming();
          }
        } catch (micErr) {
          console.warn('[DevSync Voice] Media stream permission prompt notice:', micErr);
          if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
            this.onError('Microphone access was denied. You can still type doubts in the input bar or tap Quick Commands.');
            this.setState('ended');
            return;
          }
        }
      }

      await this.ensureAudioOutputContext();

      // Start Session Timer
      this.sessionSeconds = 0;
      if (this.sessionTimer) clearInterval(this.sessionTimer);
      this.sessionTimer = setInterval(() => {
        this.sessionSeconds += 1;
        this.onTimerTick(this.formatTimer(this.sessionSeconds));
      }, 1000);

      // 2. Initialize and start continuous Speech Recognition
      const started = this.initSpeechRecognizer();
      if (!started) {
        console.warn('[DevSync Voice] SpeechRecognition API not supported in this browser. Quick Commands & Text input bar active.');
        this.setState('listening', 'Voice Assistant Active (Type below or Tap Commands)');
      } else {
        this.setState('listening', 'Listening to your voice...');
      }

    } catch (err) {
      console.error('[DevSync Voice] Session initiation failed:', err);
      this.onError(err.message || 'Microphone or connection failed.');
      this.setState('ended');
    }
  }

  initSpeechRecognizer() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return false;
    }

    try {
      if (this.speechRecognizer) {
        try { this.speechRecognizer.abort(); } catch (e) {}
      }

      this.speechRecognizer = new SpeechRecognition();
      this.speechRecognizer.continuous = true;
      this.speechRecognizer.interimResults = false;
      this.speechRecognizer.maxAlternatives = 1;
      this.speechRecognizer.lang = this.options.language || 'en-US';

      this.speechRecognizer.onstart = () => {
        if (this.state !== 'speaking' && this.state !== 'thinking') {
          this.setState('listening', 'Listening to your voice...');
        }
      };

      this.speechRecognizer.onresult = async (event) => {
        if (this.isProcessingSpeech || this.isMuted) return;

        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        const cleanTranscript = finalTranscript.trim();
        if (cleanTranscript.length > 0) {
          this.isProcessingSpeech = true;
          this.pauseRecognition();

          // Display recognized speech in conversation transcript
          this.onTranscript('user', cleanTranscript, true);

          // Route through the validated assistant pipeline
          try {
            await this.sendSpokenCommand(cleanTranscript);
          } finally {
            this.isProcessingSpeech = false;
            if (this.state === 'listening' && !this.isMuted) {
              this.resumeRecognition();
            }
          }
        }
      };

      this.speechRecognizer.onerror = (e) => {
        console.warn('[DevSync Voice SpeechRecognition Event]:', e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          this.onError('Microphone permission was not granted. Please allow microphone in browser settings.');
          this.stopSession();
        } else if (e.error === 'no-speech') {
          // Normal silence, keep session alive
        }
      };

      this.speechRecognizer.onend = () => {
        // Automatically restart speech recognition if session is active and not thinking/speaking
        if (this.state === 'listening' && !this.isProcessingSpeech && !this.isMuted) {
          setTimeout(() => {
            if (this.state === 'listening' && !this.isProcessingSpeech && !this.isMuted) {
              try {
                this.speechRecognizer.start();
              } catch (startErr) {
                // Already started or restarting
              }
            }
          }, 300);
        }
      };

      this.speechRecognizer.start();
      return true;
    } catch (e) {
      console.warn('[DevSync Voice] Speech recognition start exception:', e);
      return false;
    }
  }

  pauseRecognition() {
    if (this.speechRecognizer) {
      try {
        this.speechRecognizer.abort();
      } catch (e) {}
    }
  }

  resumeRecognition() {
    if (this.speechRecognizer && this.state === 'listening' && !this.isProcessingSpeech && !this.isMuted) {
      try {
        this.speechRecognizer.start();
      } catch (e) {
        // Already active
      }
    }
  }

  bindMicrophoneStreaming() {
    if (!this.inputProcessor) return;

    const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount);

    this.inputProcessor.onaudioprocess = (e) => {
      if (this.isMuted || this.state === 'speaking') {
        this.onAudioLevel(0);
        return;
      }

      // Audio Level calculation for visualizer & orb
      this.inputAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalizedLevel = Math.min(1.0, avg / 128.0);
      this.onAudioLevel(normalizedLevel);

      // Convert Float32 to 16-bit PCM little-endian
      const inputBuffer = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputBuffer.length);
      for (let i = 0; i < inputBuffer.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768));
      }

      // Base64 encode
      const uint8 = new Uint8Array(pcm16.buffer);
      let binary = '';
      const len = uint8.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Audio = btoa(binary);

      // Send RealtimeInput mediaChunk
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const chunkMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }
            ]
          }
        };
        this.ws.send(JSON.stringify(chunkMessage));
      }
    };
  }

  handleServerMessage(rawData) {
    try {
      let data;
      if (typeof rawData === 'string') {
        data = JSON.parse(rawData);
      } else {
        return;
      }

      const serverContent = data.serverContent;
      if (!serverContent) return;

      // 1. Interruption handling (User barged in while AI was speaking)
      if (serverContent.interrupted) {
        console.log('[DevSync Voice] Barge-in interruption detected.');
        this.stopAudioPlayback();
        this.setState('interrupted');
        setTimeout(() => {
          if (this.state === 'interrupted') {
            this.setState('listening');
          }
        }, 500);
        return;
      }

      // 2. Model Turn audio playback & transcript
      if (serverContent.modelTurn) {
        const parts = serverContent.modelTurn.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            this.playPcmAudioChunk(part.inlineData.data);
          }
          if (part.text) {
            this.onTranscript('ai', part.text, false);
          }
        }
      }

      // 3. Turn complete
      if (serverContent.turnComplete) {
        this.waitForAudioCompletion();
      }

    } catch (err) {
      console.error('[DevSync Voice] Error parsing server message:', err);
    }
  }

  playPcmAudioChunk(base64Data) {
    if (!this.outputAudioCtx) return;

    try {
      // Decode Base64 to ArrayBuffer
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const numSamples = Math.floor(bytes.byteLength / 2);
      const pcm16 = new Int16Array(bytes.buffer, 0, numSamples);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      // Create AudioBuffer at 24kHz
      const buffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      // Create source and schedule
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioCtx.destination);

      const startTime = Math.max(this.outputAudioCtx.currentTime, this.scheduledAudioTime);
      source.start(startTime);
      this.scheduledAudioTime = startTime + buffer.duration;

      this.activeAudioSources.push(source);
      source.onended = () => {
        const index = this.activeAudioSources.indexOf(source);
        if (index > -1) {
          this.activeAudioSources.splice(index, 1);
        }
      };

      this.setState('speaking');

    } catch (err) {
      console.error('[DevSync Voice] Audio playback failed:', err);
    }
  }

  waitForAudioCompletion() {
    const checkCompletion = () => {
      if (this.outputAudioCtx && this.outputAudioCtx.currentTime >= this.scheduledAudioTime) {
        if (this.state === 'speaking') {
          this.setState(this.isMuted ? 'muted' : 'listening');
        }
      } else {
        requestAnimationFrame(checkCompletion);
      }
    };
    checkCompletion();
  }

  stopAudioPlayback() {
    for (const source of this.activeAudioSources) {
      try {
        source.stop();
      } catch (e) {}
    }
    this.activeAudioSources = [];
    if (this.outputAudioCtx) {
      this.scheduledAudioTime = this.outputAudioCtx.currentTime;
    }
  }

  /* =========================================================================
     RESILIENT VOICE RELAY FALLBACK (Web Speech + Gemini TTS)
     ========================================================================= */
  async activateFallbackMode() {
    console.log('[DevSync Voice] Activating DevSync Voice Relay fallback...');
    this.isFallbackMode = true;

    await this.ensureAudioOutputContext();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[DevSync Voice] SpeechRecognition API unavailable. Quick Commands & Text Bar are active.');
      this.setState('listening', 'Voice Relay Active (Type below or Tap Commands)');
      this.onTranscript('ai', 'DevSync Voice Assistant is active. Type your doubts in the input bar below or tap a Quick Command.', true);
      return;
    }

    this.fallbackRecognition = new SpeechRecognition();
    this.fallbackRecognition.continuous = true;
    this.fallbackRecognition.interimResults = false;
    this.fallbackRecognition.lang = this.options.language || 'en-US';

    this.fallbackRecognition.onstart = () => {
      this.setState('listening', 'DevSync Voice Relay Active');
    };

    this.fallbackRecognition.onresult = async (event) => {
      const lastResultIndex = event.results.length - 1;
      const transcriptText = event.results[lastResultIndex][0].transcript.trim();

      if (transcriptText) {
        this.onTranscript('user', transcriptText, true);
        await this.sendSpokenCommand(transcriptText);
      }
    };

    this.fallbackRecognition.onerror = (e) => {
      console.warn('[DevSync Voice Fallback] Recognition event:', e.error);
    };

    try {
      this.fallbackRecognition.start();
    } catch (e) {
      console.warn('[DevSync Voice Fallback] Recognition start:', e);
    }
  }

  async sendSpokenCommand(text) {
    this.setState('thinking');
    await this.ensureAudioOutputContext();

    try {
      const chatRes = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          repo: this.options.activeRepo,
          branch: this.options.activeBranch
        })
      }).then(r => r.json());

      const replyText = chatRes.reply || "DevSync AI has processed your request.";
      this.onTranscript('ai', replyText, true);

      // Synthesize spoken voice using Gemini TTS
      const synthRes = await fetch(this.options.synthesizeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: replyText,
          voiceName: this.options.voiceName || 'Puck'
        })
      }).then(r => r.json());

      if (synthRes.ok && synthRes.audioBase64) {
        try {
          const mime = synthRes.mimeType || 'audio/wav';
          const audioUrl = `data:${mime};base64,${synthRes.audioBase64}`;
          const voiceAudio = new Audio(audioUrl);

          voiceAudio.onplay = () => {
            this.setState('speaking');
          };
          voiceAudio.onended = () => {
            this.setState(this.isMuted ? 'muted' : 'listening');
            this.resumeRecognition();
          };
          voiceAudio.onerror = () => {
            this.playPcmAudioChunk(synthRes.audioBase64);
            this.waitForAudioCompletion();
            this.resumeRecognition();
          };

          await voiceAudio.play();
        } catch (playErr) {
          console.warn('[DevSync Voice] Audio play exception, falling back to PCM:', playErr);
          this.playPcmAudioChunk(synthRes.audioBase64);
          this.waitForAudioCompletion();
          this.resumeRecognition();
        }
      } else {
        // Native SpeechSynthesis fallback
        if (window.speechSynthesis) {
          const utter = new SpeechSynthesisUtterance(replyText);
          utter.lang = this.options.language || 'en-US';
          utter.onstart = () => this.setState('speaking');
          utter.onend = () => {
            this.setState('listening');
            this.resumeRecognition();
          };
          window.speechSynthesis.speak(utter);
        } else {
          this.setState('listening');
          this.resumeRecognition();
        }
      }

    } catch (err) {
      console.error('[DevSync Voice] Command execution failed:', err);
      this.setState('listening');
      this.resumeRecognition();
    }
  }

  stopSession() {
    // Stop recording tracks
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    // Stop and disconnect audio contexts
    if (this.inputProcessor) {
      this.inputProcessor.disconnect();
      this.inputProcessor = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close();
      this.inputAudioCtx = null;
    }
    this.stopAudioPlayback();
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close();
      this.outputAudioCtx = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Stop Speech Recognizer
    if (this.speechRecognizer) {
      try {
        this.speechRecognizer.abort();
      } catch (e) {}
      this.speechRecognizer = null;
    }
    this.isProcessingSpeech = false;

    // Stop Fallback Recognition
    if (this.fallbackRecognition) {
      try {
        this.fallbackRecognition.stop();
      } catch (e) {}
      this.fallbackRecognition = null;
    }

    // Clear timer
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }

    this.onAudioLevel(0);
    this.setState('ended');
  }

  formatTimer(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}
