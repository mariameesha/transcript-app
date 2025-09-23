/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {GoogleGenAI} from '@google/genai';

const MODEL_NAME = 'gemini-2.5-flash';

interface Note {
  id: string;
  rawTranscription: string;
  polishedNote: string; // This will store the HTML from Gemini
  summarizedNoteHTML: string; // Stores HTML summary from Gemini
  translatedNoteHTML: string; // Stores HTML translated content
  translatedTargetLanguage: string; // Stores the language it was translated to
  timestamp: number;
}

class VoiceNotesApp {
  private genAI: any;
  private mediaRecorder: MediaRecorder | null = null;
  private recordButton: HTMLButtonElement;
  private recordingStatus: HTMLDivElement;
  private rawTranscription: HTMLDivElement;
  private polishedNote: HTMLDivElement;
  private summarizedNote: HTMLDivElement;
  private translatedNote: HTMLDivElement; // For translated display
  private newButton: HTMLButtonElement;
  private themeToggleButton: HTMLButtonElement;
  private themeToggleIcon: HTMLElement;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private currentNote: Note | null = null;
  private stream: MediaStream | null = null;
  private editorTitle: HTMLDivElement;
  private mainContent: HTMLDivElement;

  private recordingInterface: HTMLDivElement;
  private liveRecordingTitle: HTMLDivElement;
  private liveWaveformCanvas: HTMLCanvasElement | null;
  private liveWaveformCtx: CanvasRenderingContext2D | null = null;
  private liveRecordingTimerDisplay: HTMLDivElement;
  private statusIndicatorDiv: HTMLDivElement | null;

  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private waveformDataArray: Uint8Array<ArrayBuffer> | null = null;
  private waveformDrawingId: number | null = null;
  private timerIntervalId: number | null = null;
  private recordingStartTime: number = 0;

  // Speaker Diarization, Download, Summary, Copy, Translate
  private downloadButton: HTMLButtonElement;
  private copyActiveNoteButton: HTMLButtonElement;
  private summarizeNoteButton: HTMLButtonElement;
  private translateNoteButton: HTMLButtonElement;
  private editSpeakersButton: HTMLButtonElement;
  private speakerEditPanel: HTMLDivElement;
  private speakerNameMap: Map<string, string>; // Stores "Original Speaker Label" -> "Custom Name"

  // Audio Upload
  private uploadAudioButton: HTMLButtonElement;
  private audioUploadInput: HTMLInputElement;
  private isProcessingUpload = false;

  // Tab Navigation
  private tabNavigation: HTMLElement;
  private tabButtons: NodeListOf<HTMLButtonElement>;
  private activeTabIndicator: HTMLElement;
  private noteContents: NodeListOf<HTMLDivElement>;
  private currentActiveTab: string = 'polished';

  // Upload Progress
  private uploadProgressContainer: HTMLDivElement | null;
  private uploadProgressBar: HTMLDivElement | null;
  private uploadProgressPercentage: HTMLSpanElement | null;
  private uploadProgressETA: HTMLSpanElement | null;
  private currentProgressIntervalId: number | null = null;
  private currentUploadProgress: number = 0;

  // Login Portal properties
  private loginPortal: HTMLDivElement;
  private loginForm: HTMLFormElement;
  private usernameInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private loginButton: HTMLButtonElement;
  private loginError: HTMLDivElement;
  private appContainer: HTMLDivElement;


  constructor() {
    this.genAI = new GoogleGenAI({apiKey: process.env.API_KEY});

    // Login elements
    this.loginPortal = document.getElementById('loginPortal') as HTMLDivElement;
    this.loginForm = document.getElementById('loginForm') as HTMLFormElement;
    this.usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
    this.passwordInput = document.getElementById('passwordInput') as HTMLInputElement;
    this.loginButton = document.getElementById('loginButton') as HTMLButtonElement;
    this.loginError = document.getElementById('loginError') as HTMLDivElement;
    this.appContainer = document.querySelector('.app-container') as HTMLDivElement;

    this.recordButton = document.getElementById(
      'recordButton',
    ) as HTMLButtonElement;
    this.recordingStatus = document.getElementById(
      'recordingStatus',
    ) as HTMLDivElement;
    this.rawTranscription = document.getElementById(
      'rawTranscription',
    ) as HTMLDivElement;
    this.polishedNote = document.getElementById(
      'polishedNote',
    ) as HTMLDivElement;
    this.summarizedNote = document.getElementById(
        'summarizedNote',
    ) as HTMLDivElement;
    this.translatedNote = document.getElementById(
        'translatedNote',
    ) as HTMLDivElement;
    this.newButton = document.getElementById('newButton') as HTMLButtonElement;
    this.themeToggleButton = document.getElementById(
      'themeToggleButton',
    ) as HTMLButtonElement;
    this.themeToggleIcon = this.themeToggleButton.querySelector(
      'i',
    ) as HTMLElement;
    this.editorTitle = document.querySelector(
      '.editor-title',
    ) as HTMLDivElement;
    this.mainContent = document.querySelector('.main-content') as HTMLDivElement;

    this.recordingInterface = document.querySelector(
      '.recording-interface',
    ) as HTMLDivElement;
    this.liveRecordingTitle = document.getElementById(
      'liveRecordingTitle',
    ) as HTMLDivElement;
    this.liveWaveformCanvas = document.getElementById(
      'liveWaveformCanvas',
    ) as HTMLCanvasElement;
    this.liveRecordingTimerDisplay = document.getElementById(
      'liveRecordingTimerDisplay',
    ) as HTMLDivElement;

    this.downloadButton = document.getElementById('downloadButton') as HTMLButtonElement;
    this.copyActiveNoteButton = document.getElementById('copyActiveNoteButton') as HTMLButtonElement;
    this.summarizeNoteButton = document.getElementById('summarizeNoteButton') as HTMLButtonElement;
    this.translateNoteButton = document.getElementById('translateNoteButton') as HTMLButtonElement;
    this.editSpeakersButton = document.getElementById('editSpeakersButton') as HTMLButtonElement;
    this.speakerEditPanel = document.getElementById('speakerEditPanel') as HTMLDivElement;
    this.speakerNameMap = new Map();

    this.uploadAudioButton = document.getElementById('uploadAudioButton') as HTMLButtonElement;
    this.audioUploadInput = document.getElementById('audioUploadInput') as HTMLInputElement;

    // Tab Navigation Elements
    this.tabNavigation = document.querySelector('.tab-navigation') as HTMLElement;
    this.tabButtons = this.tabNavigation.querySelectorAll('.tab-button');
    this.activeTabIndicator = this.tabNavigation.querySelector('.active-tab-indicator') as HTMLElement;
    this.noteContents = document.querySelectorAll('.note-content') as NodeListOf<HTMLDivElement>;

    // Upload Progress Elements
    this.uploadProgressContainer = document.getElementById('uploadProgressContainer') as HTMLDivElement;
    this.uploadProgressBar = document.getElementById('uploadProgressBar') as HTMLDivElement;
    this.uploadProgressPercentage = document.getElementById('uploadProgressPercentage') as HTMLSpanElement;
    this.uploadProgressETA = document.getElementById('uploadProgressETA') as HTMLSpanElement;


    if (this.liveWaveformCanvas) {
      this.liveWaveformCtx = this.liveWaveformCanvas.getContext('2d');
    } else {
      console.warn(
        'Live waveform canvas element not found. Visualizer will not work.',
      );
    }

    if (this.recordingInterface) {
      this.statusIndicatorDiv = this.recordingInterface.querySelector(
        '.status-indicator',
      ) as HTMLDivElement;
    } else {
      console.warn('Recording interface element not found.');
      this.statusIndicatorDiv = null;
    }

    this.initLogin(); // Initialize login first
    this.bindEventListeners();
    this.initTheme();
    this.setupTabNavigation();
    this.createNewNote(); // This will also set initial tab

    this.recordingStatus.textContent = 'Ready to record or upload';
  }

  private initLogin(): void {
    this.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
    });
  }

  private async handleLogin(): Promise<void> {
  const username = this.usernameInput.value.trim();
  const password = this.passwordInput.value;

  // Reset UI state from the old version
  this.loginError.textContent = '';
  this.loginError.classList.remove('visible');
  this.loginForm.classList.remove('error-shake');

  // (optional) basic guard
  if (!username || !password) {
    this.loginError.textContent = 'Please enter email and password.';
    this.loginError.classList.add('visible');
    this.loginForm.classList.add('error-shake');
    setTimeout(() => this.loginForm.classList.remove('error-shake'), 500);
    return;
  }

  // Disable button while calling API (purely UX, doesn’t affect other logic)
  this.loginButton.disabled = true;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // If later you switch to cookie-based auth, you can add:
      // credentials: 'include',
      body: JSON.stringify({ email: username, password }),
    });

    if (res.ok) {
      // Optionally read JSON; your server returns { success: true }
      // const data = await res.json();

      // ✅ Keep the exact same success UI flow you already had
      this.loginPortal.classList.add('hidden');
      setTimeout(() => {
        if (this.loginPortal) this.loginPortal.style.display = 'none';
      }, 500);

      if (this.appContainer) {
        this.appContainer.style.display = 'flex';
      }
    } else {
      // Match your previous error UX exactly
      this.loginError.textContent = 'Invalid email or password.';
      this.loginError.classList.add('visible');
      this.loginForm.classList.add('error-shake');
      setTimeout(() => this.loginForm.classList.remove('error-shake'), 500);
    }
  } catch (err) {
    console.error('Login request failed:', err);
    this.loginError.textContent = 'Unable to reach server. Please try again.';
    this.loginError.classList.add('visible');
    this.loginForm.classList.add('error-shake');
    setTimeout(() => this.loginForm.classList.remove('error-shake'), 500);
  } finally {
    this.loginButton.disabled = false;
  }
}
  private bindEventListeners(): void {
    this.recordButton.addEventListener('click', () => this.toggleRecording());
    this.newButton.addEventListener('click', () => this.createNewNote());
    this.themeToggleButton.addEventListener('click', () => this.toggleTheme());
    this.downloadButton.addEventListener('click', () => this.downloadTranscript());
    this.copyActiveNoteButton.addEventListener('click', () => this.copyActiveNoteContentToClipboard());
    this.summarizeNoteButton.addEventListener('click', () => this.handleSummarizeNote());
    this.translateNoteButton.addEventListener('click', () => this.handleTranslateNote());
    this.editSpeakersButton.addEventListener('click', () => this.toggleSpeakerEditPanel());
    this.uploadAudioButton.addEventListener('click', () => this.audioUploadInput.click());
    this.audioUploadInput.addEventListener('change', (event) => this.handleAudioFileUpload(event));


    const applySpeakerNamesButton = this.speakerEditPanel.querySelector('#applySpeakerNamesButton');
    if (applySpeakerNamesButton) {
        applySpeakerNamesButton.addEventListener('click', () => this.applySpeakerNameChanges());
    }
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private setupTabNavigation(): void {
    this.tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = (e.currentTarget as HTMLElement).dataset.tab;
            if (tabName) {
                this.setActiveTab(tabName);
            }
        });
    });
    // Set initial active tab state without animation
    this.setActiveTab(this.currentActiveTab, true);
  }

  private setActiveTab(tabName: string, skipAnimation = false): void {
    this.currentActiveTab = tabName;
    let activeButton: HTMLButtonElement | null = null;

    this.tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
            activeButton = btn;
        } else {
            btn.classList.remove('active');
        }
    });

    this.noteContents.forEach(content => {
        let isActive = false;
        if (tabName === 'polished' && content.id === 'polishedNote') {
            isActive = true;
        } else if (tabName === 'raw' && content.id === 'rawTranscription') {
            isActive = true;
        } else if (tabName === 'summary' && content.id === 'summarizedNote') {
            isActive = true;
        } else if (tabName === 'translated' && content.id === 'translatedNote') {
            isActive = true;
        }


        if (isActive) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    if (activeButton && this.activeTabIndicator) {
        const originalTransition = this.activeTabIndicator.style.transition;
        if (skipAnimation) {
            this.activeTabIndicator.style.transition = 'none';
        } else {
            this.activeTabIndicator.style.transition = ''; // Use CSS defined transition
        }

        this.activeTabIndicator.style.left = `${activeButton.offsetLeft}px`;
        this.activeTabIndicator.style.width = `${activeButton.offsetWidth}px`;

        if (skipAnimation) {
            // Force reflow to apply immediate change then restore transition
            this.activeTabIndicator.offsetHeight;
            this.activeTabIndicator.style.transition = originalTransition || '';
        }
    }
    this.updateCopyButtonState(); // Update copy button based on new active tab
  }


  private handleResize(): void {
    if (
      this.isRecording &&
      this.liveWaveformCanvas &&
      this.liveWaveformCanvas.style.display === 'block'
    ) {
      requestAnimationFrame(() => {
        this.setupCanvasDimensions();
      });
    }
    // Adjust tab indicator on resize
    requestAnimationFrame(() => {
        const currentActiveButton = this.tabNavigation.querySelector(`.tab-button[data-tab="${this.currentActiveTab}"]`) as HTMLButtonElement;
        if (currentActiveButton && this.activeTabIndicator) {
            this.activeTabIndicator.style.transition = 'none'; // No animation on resize
            this.activeTabIndicator.style.left = `${currentActiveButton.offsetLeft}px`;
            this.activeTabIndicator.style.width = `${currentActiveButton.offsetWidth}px`;
            this.activeTabIndicator.offsetHeight; // Reflow
            this.activeTabIndicator.style.transition = '';
        }
    });
  }

  private setupCanvasDimensions(): void {
    if (!this.liveWaveformCanvas || !this.liveWaveformCtx) return;

    const canvas = this.liveWaveformCanvas;
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    this.liveWaveformCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      this.themeToggleIcon.classList.remove('fa-sun');
      this.themeToggleIcon.classList.add('fa-moon');
    } else {
      document.body.classList.remove('light-mode');
      this.themeToggleIcon.classList.remove('fa-moon');
      this.themeToggleIcon.classList.add('fa-sun');
    }
  }

  private toggleTheme(): void {
    document.body.classList.toggle('light-mode');
    if (document.body.classList.contains('light-mode')) {
      localStorage.setItem('theme', 'light');
      this.themeToggleIcon.classList.remove('fa-sun');
      this.themeToggleIcon.classList.add('fa-moon');
    } else {
      localStorage.setItem('theme', 'dark');
      this.themeToggleIcon.classList.remove('fa-moon');
      this.themeToggleIcon.classList.add('fa-sun');
    }
  }

  private async toggleRecording(): Promise<void> {
    if (this.isProcessingUpload) {
        this.recordingStatus.textContent = "Cannot record while upload is processing.";
        return;
    }
    if (!this.isRecording) {
      await this.startRecording();
    } else {
      await this.stopRecording();
    }
  }

  private setupAudioVisualizer(): void {
    if (!this.stream || this.audioContext) return;

    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyserNode = this.audioContext.createAnalyser();

    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.75;

    const bufferLength = this.analyserNode.frequencyBinCount;
    this.waveformDataArray = new Uint8Array(bufferLength);

    source.connect(this.analyserNode);
  }

  private drawLiveWaveform(): void {
    if (
      !this.analyserNode ||
      !this.waveformDataArray ||
      !this.liveWaveformCtx ||
      !this.liveWaveformCanvas ||
      !this.isRecording
    ) {
      if (this.waveformDrawingId) cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
      return;
    }

    this.waveformDrawingId = requestAnimationFrame(() =>
      this.drawLiveWaveform(),
    );
    this.analyserNode.getByteFrequencyData(this.waveformDataArray);

    const ctx = this.liveWaveformCtx;
    const canvas = this.liveWaveformCanvas;

    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;

    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    const bufferLength = this.analyserNode.frequencyBinCount;
    const numBars = Math.floor(bufferLength * 0.5);

    if (numBars === 0) return;

    const totalBarPlusSpacingWidth = logicalWidth / numBars;
    const barWidth = Math.max(1, Math.floor(totalBarPlusSpacingWidth * 0.7));
    const barSpacing = Math.max(0, Math.floor(totalBarPlusSpacingWidth * 0.3));

    let x = 0;

    const recordingColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-recording')
        .trim() || '#ff3b30';
    ctx.fillStyle = recordingColor;

    for (let i = 0; i < numBars; i++) {
      if (x >= logicalWidth) break;

      const dataIndex = Math.floor(i * (bufferLength / numBars));
      const barHeightNormalized = this.waveformDataArray[dataIndex] / 255.0;
      let barHeight = barHeightNormalized * logicalHeight;

      if (barHeight < 1 && barHeight > 0) barHeight = 1;
      barHeight = Math.round(barHeight);

      const y = Math.round((logicalHeight - barHeight) / 2);

      ctx.fillRect(Math.floor(x), y, barWidth, barHeight);
      x += barWidth + barSpacing;
    }
  }

  private updateLiveTimer(): void {
    if (!this.isRecording || !this.liveRecordingTimerDisplay) return;
    const now = Date.now();
    const elapsedMs = now - this.recordingStartTime;

    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((elapsedMs % 1000) / 10);

    this.liveRecordingTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  }

  private startLiveDisplay(): void {
    if (
      !this.recordingInterface ||
      !this.liveRecordingTitle ||
      !this.liveWaveformCanvas ||
      !this.liveRecordingTimerDisplay
    ) {
      console.warn(
        'One or more live display elements are missing. Cannot start live display.',
      );
      return;
    }

    if (this.mainContent) {
      this.mainContent.classList.add('live-recording-active');
    }
    this.recordingInterface.classList.add('is-live');
    this.liveRecordingTitle.style.display = 'block';
    this.liveWaveformCanvas.style.display = 'block';
    this.liveRecordingTimerDisplay.style.display = 'block';

    this.setupCanvasDimensions();

    if (this.statusIndicatorDiv) this.statusIndicatorDiv.style.display = 'none';

    const iconElement = this.recordButton.querySelector(
      '.record-button-inner i',
    ) as HTMLElement;
    if (iconElement) {
      iconElement.classList.remove('fa-microphone');
      iconElement.classList.add('fa-stop');
    }

    const currentTitle = this.editorTitle.textContent?.trim();
    const placeholder =
      this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
    this.liveRecordingTitle.textContent =
      currentTitle && currentTitle !== placeholder
        ? currentTitle
        : 'New Recording';

    this.setupAudioVisualizer();
    this.drawLiveWaveform();

    this.recordingStartTime = Date.now();
    this.updateLiveTimer();
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.timerIntervalId = window.setInterval(() => this.updateLiveTimer(), 50);
  }

  private stopLiveDisplay(): void {
    if (this.mainContent) {
      this.mainContent.classList.remove('live-recording-active');
    }
    if (
      !this.recordingInterface ||
      !this.liveRecordingTitle ||
      !this.liveWaveformCanvas ||
      !this.liveRecordingTimerDisplay
    ) {
      if (this.recordingInterface)
        this.recordingInterface.classList.remove('is-live');
      return;
    }
    this.recordingInterface.classList.remove('is-live');
    this.liveRecordingTitle.style.display = 'none';
    this.liveWaveformCanvas.style.display = 'none';
    this.liveRecordingTimerDisplay.style.display = 'none';

    if (this.statusIndicatorDiv)
      this.statusIndicatorDiv.style.display = 'block';

    const iconElement = this.recordButton.querySelector(
      '.record-button-inner i',
    ) as HTMLElement;
    if (iconElement) {
      iconElement.classList.remove('fa-stop');
      iconElement.classList.add('fa-microphone');
    }

    if (this.waveformDrawingId) {
      cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
    }
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    if (this.liveWaveformCtx && this.liveWaveformCanvas) {
      this.liveWaveformCtx.clearRect(
        0,
        0,
        this.liveWaveformCanvas.width,
        this.liveWaveformCanvas.height,
      );
    }

    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext
          .close()
          .catch((e) => console.warn('Error closing audio context', e));
      }
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.waveformDataArray = null;
  }

  private async startRecording(): Promise<void> {
    try {
      this.audioChunks = [];
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.resetUIForNewNote(false); // Use the refactored method
      this.recordingStatus.textContent = 'Requesting microphone access...';

      this.recordButton.disabled = true;
      this.uploadAudioButton.disabled = true;


      try {
        this.stream = await navigator.mediaDevices.getUserMedia({audio: true});
      } catch (err) {
        console.error('Failed with basic constraints:', err);
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }

      try {
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: 'audio/webm',
        });
      } catch (e) {
        console.error('audio/webm not supported, trying default:', e);
        this.mediaRecorder = new MediaRecorder(this.stream);
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0)
          this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        this.stopLiveDisplay();
        this.recordButton.disabled = false;
        this.uploadAudioButton.disabled = false;


        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          this.processAudio(audioBlob).catch((err) => {
            console.error('Error processing audio:', err);
            this.recordingStatus.textContent = 'Error processing recording';
          });
        } else {
          this.recordingStatus.textContent =
            'No audio data captured. Please try again.';
        }

        if (this.stream) {
          this.stream.getTracks().forEach((track) => {
            track.stop();
          });
          this.stream = null;
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      this.recordButton.classList.add('recording');
      this.recordButton.setAttribute('title', 'Stop Recording');
      this.recordButton.setAttribute('aria-label', 'Stop Recording');
      this.recordButton.disabled = false;


      this.startLiveDisplay();
    } catch (error) {
      console.error('Error starting recording:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';

      if (
        errorName === 'NotAllowedError' ||
        errorName === 'PermissionDeniedError'
      ) {
        this.recordingStatus.textContent =
          'Microphone permission denied. Please check browser settings and reload page.';
      } else if (
        errorName === 'NotFoundError' ||
        (errorName === 'DOMException' &&
          errorMessage.includes('Requested device not found'))
      ) {
        this.recordingStatus.textContent =
          'No microphone found. Please connect a microphone.';
      } else if (
        errorName === 'NotReadableError' ||
        errorName === 'AbortError' ||
        (errorName === 'DOMException' &&
          errorMessage.includes('Failed to allocate audiosource'))
      ) {
        this.recordingStatus.textContent =
          'Cannot access microphone. It may be in use by another application.';
      } else {
        this.recordingStatus.textContent = `Error: ${errorMessage}`;
      }

      this.isRecording = false;
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      this.recordButton.setAttribute('aria-label', 'Start Recording');
      this.recordButton.disabled = false;
      this.uploadAudioButton.disabled = false;
      this.stopLiveDisplay();
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
        this.stopLiveDisplay();
        this.recordButton.disabled = false;
        this.uploadAudioButton.disabled = false;

      }

      this.isRecording = false;

      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      this.recordButton.setAttribute('aria-label', 'Start Recording');
      this.recordingStatus.textContent = 'Processing audio...';
    } else {
      if (!this.isRecording) {
        this.stopLiveDisplay();
        this.recordButton.disabled = false;
        this.uploadAudioButton.disabled = false;
      }
    }
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    if (audioBlob.size === 0) {
      this.recordingStatus.textContent =
        'No audio data captured. Please try again.';
      return;
    }

    try {
      this.recordingStatus.textContent = 'Converting audio...';

      const reader = new FileReader();
      const readResult = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          try {
            const base64data = reader.result as string;
            const base64Audio = base64data.split(',')[1];
            resolve(base64Audio);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await readResult;

      if (!base64Audio) throw new Error('Failed to convert audio to base64');

      const mimeType = audioBlob.type || this.mediaRecorder?.mimeType || 'audio/webm';
      await this.getTranscription(base64Audio, mimeType);
    } catch (error) {
      console.error('Error in processAudio:', error);
      this.recordingStatus.textContent =
        'Error processing recording. Please try again.';
      this.recordButton.disabled = false;
      this.uploadAudioButton.disabled = false;
    }
  }

  private showUploadProgress(): void {
    if (this.uploadProgressContainer) {
        this.uploadProgressContainer.style.display = 'flex';
    }
    this.currentUploadProgress = 0;
    this.updateUploadProgressDisplay(0, "Preparing...");
  }

  private hideUploadProgress(immediate: boolean = false): void {
    if (this.currentProgressIntervalId) {
        clearInterval(this.currentProgressIntervalId);
        this.currentProgressIntervalId = null;
    }
    if (this.uploadProgressContainer) {
        if (immediate) {
            this.uploadProgressContainer.style.display = 'none';
            this.currentUploadProgress = 0;
        } else {
            // Delay hiding to show 100% or final state briefly
            setTimeout(() => {
                if (this.uploadProgressContainer) this.uploadProgressContainer.style.display = 'none';
                this.currentUploadProgress = 0; // Reset for next time
            }, 2500); 
        }
    }
  }

  private updateUploadProgressDisplay(percentage: number, etaText: string): void {
    this.currentUploadProgress = Math.min(100, Math.max(0, percentage));
    if (this.uploadProgressBar) {
        this.uploadProgressBar.style.width = `${this.currentUploadProgress}%`;
    }
    if (this.uploadProgressPercentage) {
        this.uploadProgressPercentage.textContent = `${Math.round(this.currentUploadProgress)}%`;
    }
    if (this.uploadProgressETA) {
        this.uploadProgressETA.textContent = etaText;
    }
  }

  private startSimulatedProcessingProgress(targetPercentage: number = 95, durationEstimateSeconds: number = 30): void {
    if (this.currentProgressIntervalId) {
        clearInterval(this.currentProgressIntervalId);
    }
    
    const startPercentage = this.currentUploadProgress;
    const increment = 1; 
    const totalIncrementsNeeded = targetPercentage - startPercentage;

    if (totalIncrementsNeeded <=0) {
        if(startPercentage >= targetPercentage) this.updateUploadProgressDisplay(targetPercentage, "Finalizing...");
        return;
    }

    const intervalTime = Math.max(50, (durationEstimateSeconds * 1000) / totalIncrementsNeeded);

    this.currentProgressIntervalId = window.setInterval(() => {
        const newProgress = this.currentUploadProgress + increment;
        if (newProgress < targetPercentage) {
            const timeLeft = Math.max(1, Math.round(durationEstimateSeconds * (1 - ((newProgress - startPercentage) / totalIncrementsNeeded))));
            this.updateUploadProgressDisplay(newProgress, `Processing with AI... (Est. ${timeLeft}s)`);
        } else {
            if (this.currentProgressIntervalId) clearInterval(this.currentProgressIntervalId);
            this.currentProgressIntervalId = null;
            this.updateUploadProgressDisplay(targetPercentage, "Finalizing with AI...");
        }
    }, intervalTime);
  }


  private async handleAudioFileUpload(event: Event): Promise<void> {
    if (this.isRecording) {
        this.recordingStatus.textContent = "Cannot upload while recording.";
        this.audioUploadInput.value = '';
        return;
    }
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      this.audioUploadInput.value = '';
      return;
    }

    const file = input.files[0];
    this.audioUploadInput.value = ''; // Clear input immediately

    if (!file.type.startsWith('audio/')) {
      this.recordingStatus.textContent = 'Invalid file type. Please upload an audio file.';
      return;
    }

    this.isProcessingUpload = true;
    this.recordButton.disabled = true;
    this.uploadAudioButton.disabled = true;
    
    this.resetUIForNewNote(true); // Prepare UI for the new upload's content

    this.showUploadProgress(); 
    this.updateUploadProgressDisplay(0, `Preparing: ${file.name}`);
    this.recordingStatus.textContent = `Reading file: ${file.name}...`;

    try {
      this.updateUploadProgressDisplay(5, "Reading file...");

      const reader = new FileReader();
      const readResult = new Promise<string>((resolve, reject) => {
        reader.onloadstart = () => {
             this.updateUploadProgressDisplay(10, "Reading local file...");
        };
        reader.onloadend = () => {
          try {
            this.updateUploadProgressDisplay(30, "File read. Preparing for AI...");
            const base64data = reader.result as string;
            const base64Audio = base64data.split(',')[1];
            resolve(base64Audio);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
      });
      reader.readAsDataURL(file);
      const base64Audio = await readResult;

      if (!base64Audio) throw new Error('Failed to convert uploaded audio to base64');

      this.recordingStatus.textContent = 'Processing uploaded audio... This may take a moment.';
      this.updateUploadProgressDisplay(30, "Sending to AI...");

      const fileSizeMB = file.size / (1024 * 1024);
      const estimatedDurationSeconds = Math.min(180, Math.max(20, fileSizeMB * 25 + 10)); // Base + per MB
      this.startSimulatedProcessingProgress(95, estimatedDurationSeconds);

      await this.getTranscription(base64Audio, file.type); 

      if (this.currentProgressIntervalId) {
          clearInterval(this.currentProgressIntervalId);
          this.currentProgressIntervalId = null;
      }
      this.updateUploadProgressDisplay(100, "Processing complete!");
      // recordingStatus text is updated by getPolishedNote
      this.hideUploadProgress(); 

    } catch (error) {
      console.error('Error processing uploaded file:', error);
      this.recordingStatus.textContent = 'Error processing uploaded file. Please try again.';
      if (this.currentProgressIntervalId) {
          clearInterval(this.currentProgressIntervalId);
          this.currentProgressIntervalId = null;
      }
      this.updateUploadProgressDisplay(this.currentUploadProgress, "Error occurred."); 
      this.hideUploadProgress();

    } finally {
        this.isProcessingUpload = false;
        this.recordButton.disabled = false;
        this.uploadAudioButton.disabled = false;
    }
  }


  private async getTranscription(
    base64Audio: string,
    mimeType: string,
  ): Promise<void> {
    try {
      // If called during upload, main status is handled by progress bar, but we can update a sub-status
      const statusMsg = this.isProcessingUpload ? "AI: Transcribing..." : "Getting transcription...";
      if(this.isProcessingUpload && this.uploadProgressETA) this.uploadProgressETA.textContent = statusMsg;
      else this.recordingStatus.textContent = statusMsg;


      const contents = [
        {text: 'Generate a complete, detailed transcript of this audio. Identify different speakers if possible, labeling them as Speaker 1, Speaker 2, etc. and ensuring each speaker turn is clearly marked (e.g., "Speaker 1: ...text...")'},
        {inlineData: {mimeType: mimeType, data: base64Audio}},
      ];

      const response = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
      });

      const transcriptionText = response.text;

      if (transcriptionText) {
        this.rawTranscription.textContent = transcriptionText;
        if (transcriptionText.trim() !== '') {
          this.rawTranscription.classList.remove('placeholder-active');
        } else {
          this.rawTranscription.textContent = this.rawTranscription.getAttribute('placeholder') || '';
          this.rawTranscription.classList.add('placeholder-active');
        }

        if (this.currentNote)
          this.currentNote.rawTranscription = transcriptionText;
        
        this.updateCopyButtonState();
        
        const nextStatusMsg = this.isProcessingUpload ? "AI: Formatting note..." : "Transcription complete. Polishing note...";
        if(this.isProcessingUpload && this.uploadProgressETA) this.uploadProgressETA.textContent = nextStatusMsg;
        else this.recordingStatus.textContent = nextStatusMsg;

        this.getPolishedNote().catch((err) => {
          console.error('Error polishing note:', err);
          this.recordingStatus.textContent =
            'Error polishing note after transcription.';
        });
      } else {
        this.recordingStatus.textContent =
          'Transcription failed or returned empty.';
        this.polishedNote.innerHTML =
          '<p><em>Could not transcribe audio. Please try again.</em></p>';
        this.rawTranscription.textContent =
          this.rawTranscription.getAttribute('placeholder');
        this.rawTranscription.classList.add('placeholder-active');
        this.updateAllButtonStates();
      }
    } catch (error) {
      console.error('Error getting transcription:', error);
      this.recordingStatus.textContent =
        'Error getting transcription. Please try again.';
      this.polishedNote.innerHTML = `<p><em>Error during transcription: ${error instanceof Error ? error.message : String(error)}</em></p>`;
      this.rawTranscription.textContent =
        this.rawTranscription.getAttribute('placeholder');
      this.rawTranscription.classList.add('placeholder-active');
      this.updateAllButtonStates();
    }
  }

  private async getPolishedNote(): Promise<void> {
    try {
      if (
        !this.rawTranscription.textContent ||
        this.rawTranscription.textContent.trim() === '' ||
        this.rawTranscription.classList.contains('placeholder-active')
      ) {
        this.recordingStatus.textContent = 'No transcription to polish';
        this.polishedNote.innerHTML =
          '<p><em>No transcription available to polish.</em></p>';
        this.polishedNote.classList.add('placeholder-active');
        this.updateAllButtonStates();
        return;
      }

       if (!this.currentNote) {
        this.recordingStatus.textContent = 'Error: Note data missing for polishing.';
        this.polishedNote.innerHTML = '<p><em>Error: Note data missing. Polishing aborted.</em></p>';
        this.polishedNote.classList.add('placeholder-active');
        this.updateAllButtonStates();
        return;
      }

      const statusMsg = this.isProcessingUpload ? "AI: Polishing HTML..." : "Formatting as Meeting Minutes (HTML)...";
      if(this.isProcessingUpload && this.uploadProgressETA) this.uploadProgressETA.textContent = statusMsg;
      else this.recordingStatus.textContent = statusMsg;

      // Clear previous summary and translation if polished note is being regenerated
      this.currentNote.summarizedNoteHTML = '';
      this.summarizedNote.innerHTML = this.summarizedNote.getAttribute('placeholder') || '';
      this.summarizedNote.classList.add('placeholder-active');
      this.currentNote.translatedNoteHTML = '';
      this.currentNote.translatedTargetLanguage = '';
      this.translatedNote.innerHTML = this.translatedNote.getAttribute('placeholder') || '';
      this.translatedNote.classList.add('placeholder-active');


      const meetingTimestamp = new Date(this.currentNote.timestamp);
      const meetingDate = meetingTimestamp.toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      const meetingTime = meetingTimestamp.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      const prompt = `Take the following raw audio transcription and transform it into a structured "Meeting Minutes" document, formatted in HTML.

**Raw Transcription:**
---
${this.rawTranscription.textContent}
---

**Instructions for HTML Formatting the Minutes:**
The entire output MUST be a single HTML string. Ensure all textual content is derived or accurately summarized from the raw transcription.

1.  **Meeting Title:**
    *   Use \`<h1>\` for the main meeting title. Infer a suitable title from the transcription content. If no clear topic emerges, use "Meeting Minutes".

2.  **Date and Time:**
    *   Use \`<h2>Date and Time</h2>\`.
    *   Below this, include:
        *   \`<p>Date: ${meetingDate}</p>\`
        *   \`<p>Time: ${meetingTime} (Recording Start Time)</p>\`

3.  **Attendees:**
    *   Use \`<h2>Attendees</h2>\`.
    *   List identified speakers (e.g., Speaker 1, Speaker 2) from the transcription.
    *   Format as an unordered list: \`<ul><li>Speaker 1</li><li>Speaker 2</li></ul>\`. If no distinct speakers are identified, state "Attendees not specified" or similar.

4.  **Objective of this Meeting:**
    *   Use \`<h2>Objective of this Meeting</h2>\`.
    *   Provide a concise paragraph (\`<p>\`) summarizing the main purpose or goal of the meeting as evident from the transcription.

5.  **Key Points Discussed in this Meeting:**
    *   Use \`<h2>Key Points Discussed in this Meeting</h2>\`.
    *   List the main topics and significant points discussed using an unordered list (\`<ul><li>Key point 1</li><li>Key point 2</li></ul>\`).

6.  **Action Required:**
    *   Use \`<h2>Action Required</h2>\`.
    *   List specific action items identified during the meeting using an unordered list (\`<ul><li>Action: [Task description] - Assigned to: [Speaker/Name, if identifiable] - Deadline: [Date, if mentioned]</li></ul>\`). If no actions, state "No specific action items identified."

7.  **Decision Taken:**
    *   Use \`<h2>Decision Taken</h2>\`.
    *   List any clear decisions made during the meeting using an unordered list (\`<ul><li>Decision: [Decision text]</li></ul>\`). If no decisions, state "No specific decisions recorded."

8.  **Follow-up Required:**
    *   Use \`<h2>Follow-up Required</h2>\`.
    *   List any items that require follow-up using an unordered list (\`<ul><li>Follow-up: [Item description] - Responsible: [Speaker/Name, if identifiable]</li></ul>\`). If no follow-ups, state "No follow-up items identified."

9.  **Responsible Person Table:**
    *   Use \`<h2>Responsible Person Table</h2>\`.
    *   Create an HTML table: \`<table>\`.
    *   Include a header row: \`<thead><tr><th>Task (Action/Follow-up)</th><th>Responsible Person/Speaker</th><th>Deadline (if mentioned)</th></tr></thead>\`.
    *   Include a body: \`<tbody>\`.
    *   For each action item or follow-up task identified that has a responsible person, create a table row: \`<tr><td>[Task description]</td><td>[Speaker N or Name]</td><td>[Deadline, if any, otherwise 'N/A']</td></tr>\`.
    *   If no tasks with clear responsibilities are identified, the table body can state this (e.g., \`<tr><td colspan="3">No tasks with assigned responsibilities identified.</td></tr>\`).

**General Formatting Rules:**
*   Use standard HTML tags like \`<p>\`, \`<ul>\`, \`<li>\`, \`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, \`<td>\`.
*   Ensure clear separation between sections.
*   Extract information accurately from the provided transcription. Do not invent information.
*   Remove filler words (e.g., "um," "uh") for clarity in summarized points, but retain core meaning.
*   Produce *only* the HTML formatted Meeting Minutes. Do not add any conversational preamble, sign-off, or Markdown code fences like \`\`\`html. Output pure, valid HTML.`;


      const contents = [{text: prompt}];

      const response = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
      });
      const polishedHTML = response.text;


      if (polishedHTML && this.currentNote) {
        this.currentNote.polishedNote = polishedHTML;
        this.extractDefaultSpeakers(polishedHTML); 
        this.renderContentWithSpeakerNames('polishedNote');
        this.updateSpeakerEditPanelUI();


        if (polishedHTML.trim() !== '') {
          this.polishedNote.classList.remove('placeholder-active');
        } else {
          this.polishedNote.innerHTML = this.polishedNote.getAttribute('placeholder') || '';
          this.polishedNote.classList.add('placeholder-active');
        }

        this.updateNoteTitleFromPolishedContent(polishedHTML);
        this.recordingStatus.textContent =
          this.isProcessingUpload ? 'Uploaded audio processed into Meeting Minutes.' : 'Meeting Minutes generated. Ready for next recording or upload.';
        this.updateAllButtonStates();
      } else {
        this.recordingStatus.textContent =
          'Generating Meeting Minutes failed or returned empty.';
        this.polishedNote.innerHTML =
          '<p><em>Generating Meeting Minutes returned empty. Raw transcription is available.</em></p>';
        this.polishedNote.classList.add('placeholder-active');
        this.updateAllButtonStates();
      }
    } catch (error) {
      console.error('Error generating Meeting Minutes:', error);
      this.recordingStatus.textContent =
        'Error generating Meeting Minutes. Please try again.';
      this.polishedNote.innerHTML = `<p><em>Error during Meeting Minutes generation: ${error instanceof Error ? error.message : String(error)}</em></p>`;
      this.polishedNote.classList.add('placeholder-active');
      this.updateAllButtonStates();
    }
  }

  private async handleSummarizeNote(): Promise<void> {
    if (!this.currentNote || !this.currentNote.polishedNote || this.currentNote.polishedNote.trim() === '') {
        this.recordingStatus.textContent = "No meeting minutes available to summarize.";
        this.updateButtonStateTemporary(this.summarizeNoteButton, "Nothing to summarize", false, "fa-magic");
        return;
    }

    this.recordingStatus.textContent = "Summarizing meeting minutes...";
    this.summarizeNoteButton.disabled = true;
    const summarizeIcon = this.summarizeNoteButton.querySelector('i');
    const originalSummarizeIconClass = summarizeIcon ? summarizeIcon.className : 'fas fa-magic';
    if (summarizeIcon) summarizeIcon.className = 'fas fa-spinner fa-spin';


    try {
        const summaryHTML = await this.generateSummary(this.currentNote.polishedNote);
        if (summaryHTML && this.currentNote) {
            this.currentNote.summarizedNoteHTML = summaryHTML;
            this.renderContentWithSpeakerNames('summarizedNote');
            if (summaryHTML.trim() !== '') {
                this.summarizedNote.classList.remove('placeholder-active');
            } else {
                this.summarizedNote.innerHTML = this.summarizedNote.getAttribute('placeholder') || '';
                this.summarizedNote.classList.add('placeholder-active');
            }
            this.recordingStatus.textContent = "Summary generated.";
            this.setActiveTab('summary');
        } else {
            this.recordingStatus.textContent = "Summary generation failed or returned empty.";
            this.summarizedNote.innerHTML = "<p><em>Summary generation failed.</em></p>";
            this.summarizedNote.classList.add('placeholder-active');
        }
    } catch (error) {
        console.error("Error generating summary:", error);
        this.recordingStatus.textContent = "Error generating summary.";
        this.summarizedNote.innerHTML = `<p><em>Error during summary generation: ${error instanceof Error ? error.message : String(error)}</em></p>`;
        this.summarizedNote.classList.add('placeholder-active');
    } finally {
        this.summarizeNoteButton.disabled = !(this.currentNote && this.currentNote.polishedNote.trim());
        if (summarizeIcon) summarizeIcon.className = originalSummarizeIconClass;
        this.updateCopyButtonState();
    }
}

private async generateSummary(htmlToSummarize: string): Promise<string> {
    const prompt = `Please summarize the following HTML meeting minutes. Focus on extracting:
- The main purpose or key topics of the meeting.
- All specific action items, including who is responsible and any deadlines mentioned (refer to the 'Action Required' and 'Responsible Person Table' sections of the minutes if available).
- All key decisions made (refer to the 'Decision Taken' section of the minutes if available).
The summary should be concise and presented in HTML format. Use headings (e.g., \`<h3>Key Points\`, \`<h3>Action Items\`, \`<h3>Decisions\`) for structure. List action items and decisions using \`<ul>\` and \`<li>\`. Ensure the output is pure HTML.

HTML Meeting Minutes to Summarize:
---
${htmlToSummarize}
---

Produce *only* the HTML formatted summary.`;

    const contents = [{ text: prompt }];
    const response = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
    });
    return response.text;
}

private async handleTranslateNote(): Promise<void> {
    if (!this.currentNote || !this.currentNote.polishedNote || this.currentNote.polishedNote.trim() === '') {
        this.recordingStatus.textContent = "No meeting minutes available to translate.";
        this.updateButtonStateTemporary(this.translateNoteButton, "Nothing to translate", false, "fa-language", "Translate", "fa-language");
        return;
    }

    const targetLanguage = "Roman Urdu"; // Hardcoded for now

    this.recordingStatus.textContent = `Translating to ${targetLanguage}...`;
    this.translateNoteButton.disabled = true;
    const translateIcon = this.translateNoteButton.querySelector('i');
    const originalTranslateIconClass = translateIcon ? translateIcon.className : 'fas fa-language';
    if (translateIcon) translateIcon.className = 'fas fa-spinner fa-spin';

    try {
        // Use the content from polishedNote div, which includes any user-applied speaker name changes
        const polishedContentWithAppliedSpeakers = this.polishedNote.innerHTML;

        const translatedHTML = await this.generateTranslation(polishedContentWithAppliedSpeakers, targetLanguage);
        if (translatedHTML && this.currentNote) {
            this.currentNote.translatedNoteHTML = translatedHTML;
            this.currentNote.translatedTargetLanguage = targetLanguage;
            
            this.translatedNote.innerHTML = translatedHTML; // Speaker names should be preserved by the translation prompt

            if (translatedHTML.trim() !== '') {
                this.translatedNote.classList.remove('placeholder-active');
            } else {
                this.translatedNote.innerHTML = this.translatedNote.getAttribute('placeholder') || '';
                this.translatedNote.classList.add('placeholder-active');
            }
            this.recordingStatus.textContent = `Translation to ${targetLanguage} complete.`;
            this.setActiveTab('translated');
        } else {
            this.recordingStatus.textContent = "Translation failed or returned empty.";
            this.translatedNote.innerHTML = "<p><em>Translation failed.</em></p>";
            this.translatedNote.classList.add('placeholder-active');
        }
    } catch (error) {
        console.error(`Error translating to ${targetLanguage}:`, error);
        this.recordingStatus.textContent = `Error translating to ${targetLanguage}.`;
        this.translatedNote.innerHTML = `<p><em>Error during translation: ${error instanceof Error ? error.message : String(error)}</em></p>`;
        this.translatedNote.classList.add('placeholder-active');
    } finally {
        this.translateNoteButton.disabled = !(this.currentNote && this.currentNote.polishedNote.trim());
        if (translateIcon) translateIcon.className = originalTranslateIconClass;
        this.updateCopyButtonState();
    }
}

private async generateTranslation(htmlToTranslate: string, targetLanguage: string): Promise<string> {
    const prompt = `Translate the textual content within the following HTML document into ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
1.  **Preserve HTML Structure:** You MUST NOT translate, alter, add, or remove any HTML tags (e.g., \`<p>\`, \`<li>\`, \`<h1>\`, \`<strong>\`, attributes, etc.). The HTML structure of the output must be identical to the input.
2.  **Translate Text Only:** Only translate the human-readable text content found within the HTML elements. This includes text in table cells (\`<td>\`, \`<th>\`), list items (\`<li>\`), paragraphs (\`<p>\`), and headings (\`<h1>\`, \`<h2>\`, etc.).
3.  **Speaker Labels & Specific Formatting:**
    *   If you encounter speaker labels like "Speaker 1", "Speaker 2", "John Doe", "Alice", etc., particularly if they are part of "Attendees" lists or in a "Responsible Person" column in a table, KEEP THESE LABELS AS THEY ARE. DO NOT translate the speaker labels themselves.
    *   For example, if an attendee is listed as \`<li>Speaker 1</li>\`, and the target language is French, it should remain \`<li>Speaker 1</li>\`, not \`<li>Locuteur 1</li>\`.
    *   Similarly, in a table row like \`<tr><td>Some task</td><td>Speaker 2</td><td>Tomorrow</td></tr>\`, "Speaker 2" should remain "Speaker 2". Translate "Some task" and "Tomorrow".
    *   Text like "Date:", "Time:", "Attendees:", "Objective of this Meeting:", "Key Points Discussed:", "Action Required:", "Decision Taken:", "Follow-up Required:", "Responsible Person Table:", "Task (Action/Follow-up):", "Responsible Person/Speaker:", "Deadline (if mentioned):" (typically found in headings or table headers) SHOULD BE TRANSLATED.
4.  **Output Format:** The output MUST be only the translated HTML content. Do not include any conversational preamble, explanations, sign-off, or Markdown code fences like \`\`\`html.

Original HTML Content to Translate:
---
${htmlToTranslate}
---

Produce *only* the HTML formatted translated content, adhering strictly to all instructions above.`;

    const contents = [{ text: prompt }];
    const response = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
    });
    return response.text;
}


  private updateNoteTitleFromPolishedContent(htmlText: string): void {
    if (!this.editorTitle) return;

    let noteTitleSet = false;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlText; 

    const h1Element = tempDiv.querySelector('h1');
    if (h1Element && h1Element.textContent) {
        const title = h1Element.textContent.trim();
        if (title) {
            this.editorTitle.textContent = title;
            this.editorTitle.classList.remove('placeholder-active');
            noteTitleSet = true;
        }
    }

    if (!noteTitleSet) {
        // Fallback if H1 is generic or missing, try to find a relevant H2 (not standard ones)
        const h2Elements = tempDiv.querySelectorAll('h2');
        for (const h2Element of Array.from(h2Elements)) {
            if (h2Element.textContent) {
                const title = h2Element.textContent.trim();
                const lowerTitle = title.toLowerCase();
                // Avoid using structural titles like "Attendees" or "Key Points" as the main note title
                const genericTitles = ["date and time", "attendees", "objective of this meeting", "key points discussed in this meeting", "action required", "decision taken", "follow-up required", "responsible person table"];
                if (title && !genericTitles.includes(lowerTitle)) {
                    this.editorTitle.textContent = title;
                    this.editorTitle.classList.remove('placeholder-active');
                    noteTitleSet = true;
                    break; 
                }
            }
        }
    }
    
    if (!noteTitleSet) {
        // Further fallback: first significant paragraph from "Objective" or "Key Points" if no suitable title found
        const objectiveHeader = Array.from(tempDiv.querySelectorAll('h2')).find(h => h.textContent?.trim().toLowerCase() === "objective of this meeting");
        let firstPContent = "";

        if (objectiveHeader) {
            let nextElement = objectiveHeader.nextElementSibling;
            while(nextElement && nextElement.tagName !== 'H2'){ // Look for content before next section
                if(nextElement.tagName === 'P' && nextElement.textContent?.trim()){
                    firstPContent = nextElement.textContent.trim();
                    break;
                }
                nextElement = nextElement.nextElementSibling;
            }
        }

        if (!firstPContent) { // If no objective, try key points
            const keyPointsHeader = Array.from(tempDiv.querySelectorAll('h2')).find(h => h.textContent?.trim().toLowerCase() === "key points discussed in this meeting");
            if (keyPointsHeader) {
                 let nextElement = keyPointsHeader.nextElementSibling;
                 // Try to get first <li> text if it's a <ul>
                 if (nextElement && nextElement.tagName === 'UL' && nextElement.querySelector('li')) {
                     firstPContent = nextElement.querySelector('li')!.textContent!.trim();
                 } else { // Or first <p> under it
                    while(nextElement && nextElement.tagName !== 'H2'){
                        if(nextElement.tagName === 'P' && nextElement.textContent?.trim()){
                            firstPContent = nextElement.textContent.trim();
                            break;
                        }
                        nextElement = nextElement.nextElementSibling;
                    }
                 }
            }
        }
        
        if (firstPContent) {
            const maxLength = 70;
            this.editorTitle.textContent = firstPContent.substring(0, maxLength) + (firstPContent.length > maxLength ? '...' : '');
            this.editorTitle.classList.remove('placeholder-active');
            noteTitleSet = true;
        }
    }


    if (!noteTitleSet) {
      const currentEditorText = this.editorTitle.textContent?.trim();
      const placeholderText = this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
      if (!this.editorTitle.textContent || currentEditorText === '' || currentEditorText === placeholderText ) {
        this.editorTitle.textContent = placeholderText;
        if (!this.editorTitle.classList.contains('placeholder-active')) {
          this.editorTitle.classList.add('placeholder-active');
        }
      }
    }
}

  private resetUIForNewNote(isForUploadInitialization: boolean = false): void {
    this.currentNote = {
      id: `note_${Date.now()}`,
      rawTranscription: '',
      polishedNote: '',
      summarizedNoteHTML: '',
      translatedNoteHTML: '',
      translatedTargetLanguage: '',
      timestamp: Date.now(),
    };

    this.rawTranscription.textContent = this.rawTranscription.getAttribute('placeholder') || '';
    this.rawTranscription.classList.add('placeholder-active');

    this.polishedNote.innerHTML = this.polishedNote.getAttribute('placeholder') || '';
    this.polishedNote.classList.add('placeholder-active');
    
    this.summarizedNote.innerHTML = this.summarizedNote.getAttribute('placeholder') || '';
    this.summarizedNote.classList.add('placeholder-active');

    this.translatedNote.innerHTML = this.translatedNote.getAttribute('placeholder') || '';
    this.translatedNote.classList.add('placeholder-active');

    if (this.editorTitle) {
      this.editorTitle.textContent = this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
      this.editorTitle.classList.add('placeholder-active');
    }
    
    if (!isForUploadInitialization && !this.isRecording) { // Avoid changing status if an upload is about to start or recording
        this.recordingStatus.textContent = 'Ready to record or upload';
    }

    this.speakerNameMap.clear();
    this.updateSpeakerEditPanelUI(); // This also hides speaker button if no speakers
    this.updateAllButtonStates(); // Disables relevant buttons
    this.setActiveTab('polished', true); // Reset to polished tab

    // Reset record button appearance if not currently in a recording or upload setup state
    if (!this.isRecording && !isForUploadInitialization) {
        this.recordButton.classList.remove('recording');
        this.recordButton.setAttribute('title', 'Start Recording');
        this.recordButton.setAttribute('aria-label', 'Start Recording');
        const iconElement = this.recordButton.querySelector('.record-button-inner i') as HTMLElement;
        if (iconElement) {
          iconElement.classList.remove('fa-stop');
          iconElement.classList.add('fa-microphone');
        }
    }
    
    // Ensure progress UI is hidden if this wasn't called for an upload that's about to start
    if (!isForUploadInitialization && this.uploadProgressContainer && this.uploadProgressContainer.style.display !== 'none') {
        this.hideUploadProgress(true);
    }
  }

  private createNewNote(): void {
    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop(); 
        // onstop will handle state changes and processing for recordings.
        // We return here to let that flow complete.
        return; 
    } else if (this.isProcessingUpload) {
        // User clicked "New Note" button DURING an active file upload.
        console.warn("Cancelling ongoing file upload to create a new note.");
        if (this.currentProgressIntervalId) {
            clearInterval(this.currentProgressIntervalId);
            this.currentProgressIntervalId = null;
        }
        this.hideUploadProgress(true); // Hide immediately
        this.isProcessingUpload = false; // Critical: reset app state flag
        
        // Re-enable buttons that were disabled by the upload
        this.recordButton.disabled = false;
        this.uploadAudioButton.disabled = false;
        // The resetUIForNewNote will set the "Ready..." status.
    } else if (!this.isRecording) { // Not recording, not processing upload
        this.stopLiveDisplay(); // Clean up live display if it was somehow active
    }

    this.resetUIForNewNote(false); // Perform the actual UI reset

    // Final check for button states if it was a manual "New Note" click
    // not interrupting a recording or an upload that's being cancelled above.
    if (!this.isRecording && !this.isProcessingUpload) {
        this.recordButton.disabled = false;
        this.uploadAudioButton.disabled = false;
    }
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractDefaultSpeakers(htmlText: string): void {
    this.speakerNameMap.clear();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlText;
    const uniqueSpeakers = new Set<string>();

    // Try to find an "Attendees" section
    const attendeesHeader = Array.from(tempDiv.querySelectorAll('h2, h3')).find(
        h => h.textContent?.trim().toLowerCase() === 'attendees'
    );

    if (attendeesHeader) {
        let nextElement = attendeesHeader.nextElementSibling;
        if (nextElement && nextElement.tagName === 'UL') { // Check if attendees are in a list
            const listItems = nextElement.querySelectorAll('li');
            listItems.forEach(li => {
                const speakerLabel = li.textContent?.trim();
                if (speakerLabel && (speakerLabel.toLowerCase().startsWith('speaker') || /^[A-Za-z]+(?:\s+[A-Za-z]+){0,2}$/.test(speakerLabel))) {
                     // Basic check for "Speaker X" or simple names
                    uniqueSpeakers.add(speakerLabel);
                }
            });
        } else if (nextElement && nextElement.tagName === 'P') { // Check if attendees are in a paragraph
            const textContent = nextElement.textContent || "";
             // Regex for "Speaker X" or "Name:" or just "Name" if it's a common pattern.
            const speakerRegex = /\b(Speaker\s+(?:\d+|[A-Z]))\b|([A-Za-z]+(?:\s+[A-Za-z]+){0,2})(?=\s*(?:,|$|\s+and\b))/g;
            let match;
            while ((match = speakerRegex.exec(textContent)) !== null) {
                const speaker = match[1] || match[2]; // match[1] for "Speaker X", match[2] for names
                if (speaker) {
                    uniqueSpeakers.add(speaker.trim());
                }
            }
        }
    }
    
    // Fallback or additional check: Look for "Speaker N:" patterns throughout the document text (less preferred now)
    // This can help if speakers are mentioned in tables or other sections but not formally in Attendees.
    if (uniqueSpeakers.size === 0) {
        const textContentOnly = tempDiv.textContent || "";
        const plainTextSpeakerRegex = /\b(Speaker\s+(?:\d+|[A-Z]))(?=\s*:?)/g; // More general, colon is optional
        let match;
        while ((match = plainTextSpeakerRegex.exec(textContentOnly)) !== null) {
          const speakerLabel = match[1]; 
          if (speakerLabel) {
            uniqueSpeakers.add(speakerLabel.trim());
          }
        }
    }


    uniqueSpeakers.forEach(speakerLabel => {
      this.speakerNameMap.set(speakerLabel, speakerLabel);
    });
  }

  private renderContentWithSpeakerNames(contentType: 'polishedNote' | 'summarizedNote'): void {
    if (!this.currentNote) return;

    let htmlContent = '';
    let targetElement: HTMLDivElement | null = null;

    if (contentType === 'polishedNote') {
        htmlContent = this.currentNote.polishedNote;
        targetElement = this.polishedNote;
    } else if (contentType === 'summarizedNote') {
        htmlContent = this.currentNote.summarizedNoteHTML;
        targetElement = this.summarizedNote;
    }

    if (!targetElement) return;

    let processedHtml = htmlContent;
    this.speakerNameMap.forEach((customName, defaultLabel) => {
        if (!defaultLabel) return; // Skip if defaultLabel is empty or undefined
        const escapedDefaultLabel = this.escapeRegExp(defaultLabel);
        
        // Regex to find the defaultLabel, potentially within HTML tags,
        // and ensure it's a whole word or a specific pattern.
        // It tries to match common ways speakers are listed or referenced.
        // 1. Inside <li> tags (for attendee lists)
        // 2. Inside <td> tags (for tables)
        // 3. Followed by a colon (dialogue-style, less common now but good fallback)
        // 4. As a standalone word/phrase (general case)

        // Simpler regex: find occurrences of the default label as a whole word,
        // trying to preserve surrounding tags if they look like simple emphasis (e.g. <strong>)
        // or if it's plain text.
        const regex = new RegExp(
            `(?<preTag>>\\s*|<\\w+[^>]*>\\s*)*` + // Optional preceding tags or ">" from parent
            `(${escapedDefaultLabel})` + // The speaker label itself
            `(?<postTag>\\s*<|\\s*:\\s*<\\/\\w+>|\\s*<\\/\\w+>|\\s*:)`, // Optional succeeding tags, colon, or "<" from child
            'gi'
        );

        // More robust replacement strategy: iterate through text nodes.
        // However, for simplicity and common HTML structures from Gemini, direct string replacement with
        // careful regex can work for many cases. If Gemini's HTML is complex, this might need refinement.
        // This regex specifically targets the label when it's likely a standalone piece of text
        // or simply wrapped, e.g., <li>Speaker 1</li>, <td>Speaker 1</td>, <p><strong>Speaker 1:</strong>...</p>
        
        // Simpler regex for general replacement:
        const simpleRegex = new RegExp(`\\b${escapedDefaultLabel}\\b`, 'g');
        processedHtml = processedHtml.replace(simpleRegex, customName);

    });

    targetElement.innerHTML = processedHtml;

    if(processedHtml.trim()){
        targetElement.classList.remove('placeholder-active');
    } else {
        targetElement.innerHTML = targetElement.getAttribute('placeholder') || '';
        targetElement.classList.add('placeholder-active');
    }
}


  private updateSpeakerEditPanelUI(): void {
    const listContainer = this.speakerEditPanel.querySelector('.speaker-list') as HTMLDivElement;
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (this.speakerNameMap.size === 0) {
      this.speakerEditPanel.style.display = 'none';
      this.editSpeakersButton.style.display = 'none';
      this.editSpeakersButton.setAttribute('aria-expanded', 'false');
      return;
    }

    this.speakerNameMap.forEach((currentName, originalLabel) => {
      const speakerItem = document.createElement('div');
      speakerItem.className = 'speaker-edit-item';

      const labelEl = document.createElement('label');
      labelEl.htmlFor = `speaker-input-${originalLabel.replace(/\s+/g, '-')}`;
      labelEl.textContent = `${originalLabel}:`;

      const inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.id = `speaker-input-${originalLabel.replace(/\s+/g, '-')}`;
      inputEl.value = currentName;
      inputEl.dataset.originalLabel = originalLabel;
      inputEl.setAttribute('aria-label', `New name for ${originalLabel}`);


      speakerItem.appendChild(labelEl);
      speakerItem.appendChild(inputEl);
      listContainer.appendChild(speakerItem);
    });

    this.editSpeakersButton.style.display = 'inline-flex';
  }

  private toggleSpeakerEditPanel(): void {
    const isHidden = this.speakerEditPanel.style.display === 'none';
    this.speakerEditPanel.style.display = isHidden ? 'block' : 'none';
    this.editSpeakersButton.setAttribute('aria-expanded', String(isHidden));
  }

  private applySpeakerNameChanges(): void {
    const inputs = this.speakerEditPanel.querySelectorAll<HTMLInputElement>('.speaker-edit-item input[data-original-label]');
    inputs.forEach(input => {
      const originalLabel = input.dataset.originalLabel;
      if (originalLabel) {
        this.speakerNameMap.set(originalLabel, input.value.trim() || originalLabel);
      }
    });
    if (this.currentNote && this.currentNote.polishedNote) {
        this.renderContentWithSpeakerNames('polishedNote');
    }
    if (this.currentNote && this.currentNote.summarizedNoteHTML) {
        // Summaries might also reference speakers, so re-render if necessary
        // However, the summary prompt doesn't explicitly ask for speaker retention in the same way.
        // For now, only re-rendering polishedNote. If summaries need it, we can add it.
        // this.renderContentWithSpeakerNames('summarizedNote');
    }
    // Also re-render translated note if it exists, as it's based on polishedNote's structure
    if (this.currentNote && this.currentNote.translatedNoteHTML && this.translatedNote.innerHTML !== this.translatedNote.getAttribute('placeholder')) {
        // To re-apply speaker names to translated content, we'd ideally re-translate or have a more complex update.
        // For now, we'll assume the translation prompt handles speaker labels correctly based on the *updated* polished note content.
        // A simple re-render might not be enough if the original translation had different labels.
        // The most robust way would be to re-translate, but that's an extra API call.
        // For now, we'll keep it simple: the original polishedNote HTML passed to translation should have the updated names.
        // The current handleTranslateNote already uses this.polishedNote.innerHTML, which is good.
    }
    this.toggleSpeakerEditPanel();
  }

  private downloadTranscript(): void {
    if (!this.currentNote || !this.currentNote.polishedNote.trim()) {
        this.updateButtonStateTemporary(this.downloadButton, 'Nothing to download', false, undefined, 'Download', 'fa-download');
        return;
    }
    // Use the innerHTML of the polishedNote div, which includes speaker name changes
    let htmlToDownload = this.polishedNote.innerHTML; 

    const noteTitle = (this.editorTitle.textContent?.trim() && !this.editorTitle.classList.contains('placeholder-active'))
                        ? this.editorTitle.textContent.trim()
                        : 'Meeting Minutes';
    const filename = `${noteTitle.replace(/[^a-z0-9\s-]/gi, '_').replace(/\s+/g, '-').toLowerCase()}.html`;

    const blob = new Blob([`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${noteTitle}</title><style>body{font-family:sans-serif;line-height:1.6;}table{border-collapse:collapse;width:100%;margin-bottom:1em;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background-color:#f2f2f2;}h1,h2{margin-top:1.5em;margin-bottom:0.5em;}</style></head><body>${htmlToDownload}</body></html>`], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  private async copyActiveNoteContentToClipboard(): Promise<void> {
    if (!this.currentNote) {
        this.updateButtonStateTemporary(this.copyActiveNoteButton, "Nothing to copy", false, "fa-copy", "Copy");
        return;
    }

    let contentToCopy = "";
    let contentType: 'text/html' | 'text/plain' = 'text/plain';
    let contentSourceForButtonFeedback = "";
    let sourceElement: HTMLElement | null = null;


    switch (this.currentActiveTab) {
        case 'polished':
            sourceElement = this.polishedNote;
            contentType = 'text/html';
            contentSourceForButtonFeedback = "Polished content ";
            break;
        case 'raw':
            contentToCopy = this.currentNote.rawTranscription; 
            contentType = 'text/plain';
            contentSourceForButtonFeedback = "Raw content ";
            break;
        case 'summary':
            sourceElement = this.summarizedNote;
            contentType = 'text/html';
            contentSourceForButtonFeedback = "Summary content ";
            break;
        case 'translated':
            sourceElement = this.translatedNote;
            contentType = 'text/html';
            contentSourceForButtonFeedback = "Translated content ";
            break;
        default:
             this.updateButtonStateTemporary(this.copyActiveNoteButton, "No active content", false, "fa-copy", "Copy");
            return;
    }
    
    if (sourceElement && contentType === 'text/html') {
        contentToCopy = sourceElement.innerHTML; 
    }


    if (!contentToCopy.trim() || (sourceElement && sourceElement.classList.contains('placeholder-active'))) {
        this.updateButtonStateTemporary(this.copyActiveNoteButton, "Nothing to copy", false, "fa-copy", "Copy");
        return;
    }

    try {
        if (contentType === 'text/html' && navigator.clipboard && navigator.clipboard.write) {
            const blob = new Blob([contentToCopy], { type: 'text/html' });
            const clipboardItem = new ClipboardItem({ 'text/html': blob });
            await navigator.clipboard.write([clipboardItem]);
            this.updateButtonStateTemporary(this.copyActiveNoteButton, `${contentSourceForButtonFeedback}copied!`, true, 'fa-check', 'Copy', 'fa-copy');
        } else { 
            if (contentType === 'text/html') { 
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = contentToCopy;
                contentToCopy = tempDiv.textContent || tempDiv.innerText || "";
            }
            await navigator.clipboard.writeText(contentToCopy);
            const feedbackMsg = contentType === 'text/html' ? `${contentSourceForButtonFeedback}copied as text` : `${contentSourceForButtonFeedback}copied!`;
            this.updateButtonStateTemporary(this.copyActiveNoteButton, feedbackMsg, true, 'fa-check', 'Copy', 'fa-copy');
        }
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        this.updateButtonStateTemporary(this.copyActiveNoteButton, 'Copy failed', false, 'fa-times-circle', 'Copy', 'fa-copy');
    }
}


  private updateButtonStateTemporary(button: HTMLButtonElement, message: string, success: boolean, tempIconClass?: string, originalButtonText?: string, originalIconClass?: string ): void {
    if (!button) return;

    const icon = button.querySelector('i');
    const span = button.querySelector('span');
    const defaultIconClass = originalIconClass || 
        (button.id === 'copyActiveNoteButton' ? 'fa-copy' : 
        (button.id === 'downloadButton' ? 'fa-download' : 
        (button.id === 'summarizeNoteButton' ? 'fa-magic' : 
        (button.id === 'translateNoteButton' ? 'fa-language' : ''))));
    const defaultButtonText = originalButtonText || 
        (button.id === 'copyActiveNoteButton' ? 'Copy' : 
        (button.id === 'downloadButton' ? 'Download' : 
        (button.id === 'summarizeNoteButton' ? 'Summarize' : 
        (button.id === 'translateNoteButton' ? 'Translate' : ''))));


    if (span) span.textContent = message;
    if (icon && tempIconClass) {
        icon.className = `fas ${tempIconClass}`;
    } else if (icon) {
        icon.className = success ? 'fas fa-check' : 'fas fa-times-circle';
    }


    const wasDisabled = button.disabled;
    button.disabled = true; 

    setTimeout(() => {
        if (span && defaultButtonText) span.textContent = defaultButtonText;
        if (icon && defaultIconClass) icon.className = `fas ${defaultIconClass}`;
        
        if (button.id === 'downloadButton' || button.id === 'summarizeNoteButton' || button.id === 'translateNoteButton') {
            button.disabled = !(this.currentNote && this.currentNote.polishedNote.trim() && !this.polishedNote.classList.contains('placeholder-active'));
        } else if (button.id === 'copyActiveNoteButton') {
           this.updateCopyButtonState();
        } else {
            button.disabled = wasDisabled; 
        }
    }, 2500);
  }

  private updateAllButtonStates(): void {
    const hasPolishedContent = this.currentNote && this.currentNote.polishedNote && this.currentNote.polishedNote.trim() !== '' && !this.polishedNote.classList.contains('placeholder-active');
    this.downloadButton.disabled = !hasPolishedContent;
    this.summarizeNoteButton.disabled = !hasPolishedContent;
    this.translateNoteButton.disabled = !hasPolishedContent;
    this.editSpeakersButton.style.display = (this.speakerNameMap.size > 0 && hasPolishedContent) ? 'inline-flex' : 'none';

    this.updateCopyButtonState();
  }
  
  private updateCopyButtonState(): void {
    let hasActiveContent = false;
    if (this.currentNote) {
        switch(this.currentActiveTab) {
            case 'polished': hasActiveContent = !!(this.currentNote.polishedNote.trim() && !this.polishedNote.classList.contains('placeholder-active')); break;
            case 'raw': hasActiveContent = !!(this.currentNote.rawTranscription.trim() && !this.rawTranscription.classList.contains('placeholder-active')); break;
            case 'summary': hasActiveContent = !!(this.currentNote.summarizedNoteHTML.trim() && !this.summarizedNote.classList.contains('placeholder-active')); break;
            case 'translated': hasActiveContent = !!(this.currentNote.translatedNoteHTML.trim() && !this.translatedNote.classList.contains('placeholder-active')); break;
        }
    }
    this.copyActiveNoteButton.disabled = !hasActiveContent;
  }

}

document.addEventListener('DOMContentLoaded', () => {
  const app = new VoiceNotesApp();

  document
    .querySelectorAll<HTMLElement>('[contenteditable][placeholder]')
    .forEach((el) => {
      const placeholder = el.getAttribute('placeholder')!;

      function updatePlaceholderState() {
        if ((el.id === 'summarizedNote' || el.id === 'translatedNote') && el.getAttribute('contenteditable') === 'false') {
             if (el.innerHTML.trim() === '' || el.innerHTML === placeholder || el.innerHTML === `<p><em>${placeholder}</em></p>`) {
                el.innerHTML = placeholder; 
                el.classList.add('placeholder-active');
            } else {
                el.classList.remove('placeholder-active');
            }
            return;
        }


        const currentText = (el.id === 'polishedNote' || el.id === 'summarizedNote' || el.id === 'translatedNote' ? el.innerHTML : el.textContent)?.trim(); 
        const placeholderHTML = `<p><em>${placeholder}</em></p>`; 


        if (el.id === 'polishedNote' || el.id === 'summarizedNote' || el.id === 'translatedNote') { 
            const isEmpty = !el.textContent?.trim() || el.innerHTML === placeholder || el.innerHTML === placeholderHTML ;
             if (isEmpty) {
                el.innerHTML = placeholder; 
                el.classList.add('placeholder-active');
            } else {
                el.classList.remove('placeholder-active');
            }
        } else { // rawTranscription
            if (currentText === '' || currentText === placeholder) {
                 if (currentText === '') el.textContent = placeholder;
                 el.classList.add('placeholder-active');
            } else {
                el.classList.remove('placeholder-active');
            }
        }
      }

      updatePlaceholderState(); 

      if (el.getAttribute('contenteditable') === 'true') {
          el.addEventListener('focus', function () {
            const isHtmlContentArea = this.id === 'polishedNote' || this.id === 'summarizedNote' || this.id === 'translatedNote';
            const currentContent = isHtmlContentArea ? this.innerHTML : this.textContent;
            const placeholderHTML = `<p><em>${placeholder}</em></p>`;
            
            if (this.classList.contains('placeholder-active') || currentContent?.trim() === placeholder.trim() || (isHtmlContentArea && currentContent?.trim() === placeholderHTML.trim()) ) {
              if (isHtmlContentArea) this.innerHTML = '<p><br></p>'; // Start with a paragraph for better UX in HTML areas
              else this.textContent = '';
              this.classList.remove('placeholder-active');
            }
          });

          el.addEventListener('blur', function () {
            const isHtmlContentArea = this.id === 'polishedNote' || this.id === 'summarizedNote' || this.id === 'translatedNote';
            // For HTML, check textContent for emptiness as innerHTML might have <p><br></p>
            const finalText = (isHtmlContentArea ? this.textContent : this.textContent)?.trim(); 
            const placeholderHTML = `<p><em>${placeholder}</em></p>`;


            if (finalText === '') {
                if (isHtmlContentArea) this.innerHTML = placeholder; // Show placeholder text directly
                else this.textContent = placeholder;
                this.classList.add('placeholder-active');
            } else {
                this.classList.remove('placeholder-active');
                // If it's polishedNote and user edited, update currentNote
                if (this.id === 'polishedNote' && app['currentNote']) {
                    app['currentNote'].polishedNote = this.innerHTML;
                }
                 if (this.id === 'rawTranscription' && app['currentNote']) {
                    app['currentNote'].rawTranscription = this.textContent || "";
                }
            }
          });
      }
    });
});

export {};