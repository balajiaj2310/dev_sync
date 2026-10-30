/**
 * DevSync Voice AI & Push-to-Talk Service
 * Handles microphone recording via browser MediaRecorder API,
 * real-time AudioContext frequency analysis, Gemini voice processing,
 * and high-fidelity spoken response playback.
 */

import { AssistantService } from './assistant-service.js';

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

    // State: idle | requesting_mic | listening | thinking | speaking | paused | error | ended
    this.state = 'idle';
    this.isMuted = false;
    this.sessionTimer = null;
    this.sessionSeconds = 0;

    // Push-to-talk recording state
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;

    // Web Audio API
    this.micStream = null;
    this.inputAudioCtx = null;
    this.inputAnalyser = null;
    this.inputProcessor = null;
    this.outputAudioCtx = null;
    this.animFrameId = null;

    // Audio Playback Player
    this.currentAudio = null;
    this.lastAudioBase64 = null;
    this.lastAudioMime = 'audio/wav';
    this.activeAudioSources = [];

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

  /* =========================================================================
     1. PUSH-TO-TALK RECORDING (Browser MediaRecorder API)
     ========================================================================= */

  /**
   * Starts recording the user's voice for push-to-talk question.
   */
  async startRecording() {
    if (this.isRecording) return;

    // Stop any ongoing speech playback first
    this.stopAudioPlayback();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onError('Microphone recording is not supported in this browser.');
      this.setState('error', 'Microphone not supported');
      return;
    }

    try {
      this.setState('requesting_mic', 'Requesting microphone permission...');

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Setup audio analyzer for reactive orb & soundwave animations
      this.setupAudioVisualizer(this.micStream);

      // Select supported audio MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];
      let selectedMime = 'audio/webm';
      for (const m of mimeTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.micStream, { mimeType: selectedMime });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(250); // Slice every 250ms
      this.isRecording = true;
      this.setState('listening', 'Listening to your question...');

    } catch (err) {
      console.warn('[DevSync Voice] getUserMedia error:', err);
      this.cleanupMicStream();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.onError('Microphone permission denied. Please allow microphone access in your browser settings.');
        this.setState('error', 'Microphone permission denied');
      } else {
        this.onError(`Microphone error: ${err.message || 'Could not access microphone.'}`);
        this.setState('error', 'Microphone access failed');
      }
    }
  }

  /**
   * Stops recording and dispatches the recorded audio blob to the AI Mentor backend.
   */
  async stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }

    this.isRecording = false;

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.recordedChunks, { type: mimeType });

        // Release microphone tracks immediately
        this.cleanupMicStream();

        if (audioBlob.size < 100) {
          this.setState('idle', 'Ready');
          this.onError('Recording was too short. Please hold the microphone and speak your question.');
          resolve(null);
          return;
        }

        // Process audio recording
        this.setState('thinking', 'DevSync AI Mentor is thinking...');

        try {
          const res = await AssistantService.sendVoiceAudio(audioBlob, {
            repo: this.options.activeRepo,
            branch: this.options.activeBranch,
            voiceName: this.options.voiceName
          });

          if (res.ok) {
            // Display transcribed question and AI answer
            if (res.transcription) {
              this.onTranscript('user', res.transcription, true);
            }
            if (res.reply) {
              this.onTranscript('ai', res.reply, true, res.audioBase64);
            }

            // Play the spoken audio response
            if (res.audioBase64 && res.audioBase64.length > 500 && !res.useBrowserTts) {
              this.playSpeechAudio(res.audioBase64, res.mimeType || 'audio/wav', res.reply);
            } else if (res.reply) {
              this.speakTextWithBrowserTts(res.reply);
            } else {
              this.setState('idle', 'Ready');
            }
          } else {
            this.onError(res.error || 'Failed to process voice query.');
            this.setState('error', 'Voice processing failed');
          }
        } catch (err) {
          console.error('[DevSync Voice] Upload error:', err);
          this.onError('Network error reaching DevSync AI Mentor.');
          this.setState('error', 'Connection error');
        }

        resolve(audioBlob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        this.cleanupMicStream();
        resolve(null);
      }
    });
  }

  /**
   * Sets up Web Audio AnalyserNode to drive the soundwave visualizer & reactive orb.
   */
  setupAudioVisualizer(stream) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      this.inputAudioCtx = new AudioContextClass();
      const source = this.inputAudioCtx.createMediaStreamSource(stream);
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 128;
      source.connect(this.inputAnalyser);

      const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount);

      const render = () => {
        if (!this.isRecording || !this.inputAnalyser) {
          this.onAudioLevel(0);
          return;
        }
        this.inputAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, avg / 120.0);
        this.onAudioLevel(normalized);
        this.animFrameId = requestAnimationFrame(render);
      };

      render();
    } catch (e) {
      console.warn('[DevSync Voice] Visualizer setup notice:', e);
    }
  }

  cleanupMicStream() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.inputAudioCtx) {
      try { this.inputAudioCtx.close(); } catch (e) {}
      this.inputAudioCtx = null;
    }
    this.inputAnalyser = null;
    this.onAudioLevel(0);
  }

  /* =========================================================================
     2. NATURAL AI VOICE RESPONSE PLAYBACK & CONTROLS
     ========================================================================= */

  /**
   * Speaks text using the browser's native Web Speech API (zero-latency, infinite quota).
   */
  speakTextWithBrowserTts(text) {
    if (!('speechSynthesis' in window) || !text) {
      this.setState('idle', 'Ready');
      return;
    }
    this.stopAudioPlayback();
    this.lastSpokenText = text;

    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' Code snippet provided in chat. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~]/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick a clean, natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')) && v.lang.startsWith('en')) || voices.find(v => v.lang.startsWith('en'));
    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.onstart = () => {
      this.setState('speaking', 'DevSync AI Mentor Speaking...');
    };
    utterance.onpause = () => {
      if (this.state === 'speaking') this.setState('paused', 'Audio Paused');
    };
    utterance.onresume = () => {
      this.setState('speaking', 'DevSync AI Mentor Speaking...');
    };
    utterance.onend = () => {
      this.setState('idle', 'Ready');
    };
    utterance.onerror = (e) => {
      console.warn('[DevSync Voice] Browser SpeechSynthesis error:', e);
      this.setState('idle', 'Ready');
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Plays spoken AI response audio and synchronizes player controls and waveform.
   */
  async playSpeechAudio(audioBase64, mimeType = 'audio/wav', fallbackText = '') {
    this.stopAudioPlayback();
    this.lastAudioBase64 = audioBase64;
    this.lastAudioMime = mimeType;
    if (fallbackText) this.lastSpokenText = fallbackText;

    // If audio is empty or flagged for browser tts, or is small silent wav header, use instant browser TTS
    if (!audioBase64 || audioBase64.length < 500) {
      if (fallbackText) {
        this.speakTextWithBrowserTts(fallbackText);
        return;
      }
      this.setState('idle', 'Ready');
      return;
    }

    try {
      const audioUrl = `data:${mimeType};base64,${audioBase64}`;
      this.currentAudio = new Audio(audioUrl);

      this.currentAudio.onplay = () => {
        this.setState('speaking', 'DevSync AI Mentor Speaking...');
      };

      this.currentAudio.onpause = () => {
        if (this.state === 'speaking') {
          this.setState('paused', 'Audio Paused');
        }
      };

      this.currentAudio.onended = () => {
        this.currentAudio = null;
        this.setState('idle', 'Ready');
      };

      this.currentAudio.onerror = (e) => {
        console.warn('[DevSync Voice] Audio element error, attempting speech fallback:', e);
        if (fallbackText) {
          this.speakTextWithBrowserTts(fallbackText);
        } else {
          this.playPcmFallback(audioBase64);
        }
      };

      await this.currentAudio.play();

    } catch (err) {
      console.warn('[DevSync Voice] Audio playback failed:', err);
      if (fallbackText) {
        this.speakTextWithBrowserTts(fallbackText);
      } else {
        this.playPcmFallback(audioBase64);
      }
    }
  }

  pauseSpeech() {
    if (window.speechSynthesis && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      this.setState('paused', 'Audio Paused');
    } else if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.setState('paused', 'Audio Paused');
    }
  }

  resumeSpeech() {
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.setState('speaking', 'DevSync AI Mentor Speaking...');
    } else if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play();
      this.setState('speaking', 'DevSync AI Mentor Speaking...');
    } else if (this.lastSpokenText) {
      this.speakTextWithBrowserTts(this.lastSpokenText);
    } else if (this.lastAudioBase64) {
      this.playSpeechAudio(this.lastAudioBase64, this.lastAudioMime);
    }
  }

  stopAudioPlayback() {
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }

    for (const s of this.activeAudioSources) {
      try { s.stop(); } catch (e) {}
    }
    this.activeAudioSources = [];

    if (this.state === 'speaking' || this.state === 'paused') {
      this.setState('idle', 'Ready');
    }
  }

  replayLastSpeech() {
    if (this.lastAudioBase64 && this.lastAudioBase64.length > 500) {
      this.playSpeechAudio(this.lastAudioBase64, this.lastAudioMime, this.lastSpokenText);
    } else if (this.lastSpokenText) {
      this.speakTextWithBrowserTts(this.lastSpokenText);
    }
  }

  playPcmFallback(base64Data) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.setState('idle', 'Ready');
        return;
      }

      if (!this.outputAudioCtx) {
        this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });
      }

      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const buffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioCtx.destination);
      source.onended = () => {
        this.setState('idle', 'Ready');
      };

      this.setState('speaking', 'DevSync AI Mentor Speaking...');
      source.start();
      this.activeAudioSources.push(source);

    } catch (e) {
      console.warn('[DevSync Voice] PCM fallback error:', e);
      this.setState('idle', 'Ready');
    }
  }

  /* =========================================================================
     3. TYPED QUESTIONS (Unified Conversation Memory)
     ========================================================================= */

  async sendSpokenCommand(text) {
    if (!text || !text.trim()) return;

    this.stopAudioPlayback();
    this.setState('thinking', 'DevSync AI Mentor is thinking...');

    try {
      const res = await AssistantService.sendMessage(text, {
        repo: this.options.activeRepo,
        branch: this.options.activeBranch,
        voiceName: this.options.voiceName
      });

      if (res.ok) {
        this.onTranscript('ai', res.reply, true, res.audioBase64);
        if (res.audioBase64 && res.audioBase64.length > 500 && !res.useBrowserTts) {
          this.playSpeechAudio(res.audioBase64, res.mimeType || 'audio/wav', res.reply);
        } else if (res.reply) {
          this.speakTextWithBrowserTts(res.reply);
        } else {
          this.setState('idle', 'Ready');
        }
      } else {
        this.onError('Could not reach DevSync AI Mentor.');
        this.setState('idle', 'Ready');
      }
    } catch (err) {
      console.error('[DevSync Voice] Command error:', err);
      this.onError('Failed to communicate with DevSync AI Mentor.');
      this.setState('error', 'Connection error');
    }
  }

  stopSession() {
    this.stopRecording();
    this.stopAudioPlayback();
    this.cleanupMicStream();
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
    this.setState('ended', 'Session ended');
  }
}
