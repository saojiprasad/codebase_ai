import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload.html',
  styleUrl: './upload.scss'
})
export class Upload {
  @Output() jobStarted = new EventEmitter<string>();

  // State signals
  isDragOver = signal(false);
  selectedFile = signal<File | null>(null);
  uploadProgress = signal(0);
  isUploading = signal(false);
  isProcessing = signal(false);
  uploadComplete = signal(false);
  errorMessage = signal<string | null>(null);

  // Base options
  aspectRatio = signal('9:16');

  // AI options
  clippingMode = signal<'smart' | 'fixed' | 'subtitle_only'>('smart');
  contentMode = signal('auto_viral');
  addSubtitles = signal(true);
  subtitleStyle = signal('hormozi');
  cropMode = signal('smart_crop');
  clipDuration = signal(45); // Used only if mode='fixed'
  enableBroll = signal(false);
  enableAudio = signal(true);
  enableSfx = signal(true);
  enableBgm = signal(true);
  effectsLevel = signal<'low' | 'medium' | 'aggressive'>('aggressive');
  musicVolume = signal(0.14);

  // Presets
  clippingModes = [
    { label: 'AI Studio', value: 'smart', desc: 'AI selects and fully edits viral clips', icon: 'auto_awesome' },
    { label: 'Fixed Clips', value: 'fixed', desc: 'Raw clips only, no editing', icon: 'straighten' },
    { label: 'Subtitle Only', value: 'subtitle_only', desc: 'Fixed clips with burned captions only', icon: 'subtitles' }
  ];

  clipDurations = [
    { value: 30, label: '30 seconds', icon: 'timer' },
    { value: 45, label: '45 seconds', icon: 'timer' },
    { value: 60, label: '60 seconds', icon: 'timer' },
    { value: 75, label: '75 seconds', icon: 'timer' },
    { value: 90, label: '90 seconds', icon: 'timer' },
    { value: 120, label: '120 seconds', icon: 'timer' },
    { value: 150, label: '150 seconds', icon: 'timer' },
    { value: 180, label: '180 seconds', icon: 'timer' }
  ];

  contentModes = [
    { label: 'Auto Viral', value: 'auto_viral', desc: 'Finds the most engaging moments', icon: 'whatshot' },
    { label: 'Podcast Viral', value: 'podcast_viral', desc: 'Stories, hooks, debates', icon: 'mic' },
    { label: 'Documentary', value: 'documentary', desc: 'Editorial story arcs', icon: 'movie' },
    { label: 'Finance Guru', value: 'finance_guru', desc: 'Money and business clips', icon: 'attach_money' },
    { label: 'Gaming Streamer', value: 'gaming_streamer', desc: 'High-action gameplay', icon: 'sports_esports' },
    { label: 'Motivational Speaker', value: 'motivational', desc: 'Emotional quote peaks', icon: 'fitness_center' },
    { label: 'Cinematic Storytelling', value: 'cinematic_storytelling', desc: 'Premium story edits', icon: 'local_movies' },
    { label: 'Debate/Drama', value: 'debate', desc: 'Arguments and reactions', icon: 'forum' },
    { label: 'Meme Style', value: 'meme_style', desc: 'Fast impact edits', icon: 'bolt' },
    { label: 'Educational Tutor', value: 'educational_tutor', desc: 'Useful lessons and explainers', icon: 'school' },
    { label: 'Luxury/Alpha Style', value: 'luxury_alpha', desc: 'Premium high-status edits', icon: 'diamond' },
    { label: 'Storytelling', value: 'storytelling', desc: 'Narrative arcs and reveals', icon: 'auto_stories' },
    { label: 'Dark Doc', value: 'dark_documentary', desc: 'Suspense and mystery', icon: 'visibility' },
    { label: 'Comedy', value: 'comedy', desc: 'Funny replay moments', icon: 'sentiment_very_satisfied' }
  ];

  subtitleStyles = [
    { label: 'Default', value: 'default', desc: 'Standard white text' },
    { label: 'Hormozi', value: 'hormozi', desc: 'Bold, yellow/white, dynamic' },
    { label: 'MrBeast', value: 'mrbeast', desc: 'Massive, colorful, popping' },
    { label: 'Iman Gadzhi', value: 'iman', desc: 'Premium creator captions' },
    { label: 'Podcast', value: 'podcast', desc: 'Clean, centered, minimal' },
    { label: 'Gaming', value: 'gaming', desc: 'Fast, intense, glowing' },
    { label: 'Documentary', value: 'documentary', desc: 'Editorial story style' },
    { label: 'Cinematic', value: 'cinematic', desc: 'Elegant, subtle fading' },
    { label: 'Minimalist', value: 'minimalist', desc: 'Quiet professional text' }
  ];

  cropModes = [
    { label: 'Smart Crop', value: 'smart_crop', desc: 'Face-aware framing' },
    { label: 'Center Crop', value: 'center_crop', desc: 'Fill screen' },
    { label: 'Letterbox', value: 'letterbox', desc: 'Black bars' }
  ];

  effectsLevels = [
    { label: 'Low', value: 'low', desc: 'Cleaner, subtle editor movement' },
    { label: 'Medium', value: 'medium', desc: 'Balanced zooms and flashes' },
    { label: 'Aggressive', value: 'aggressive', desc: 'CapCut-style high retention edits' }
  ];

  aspectPresets = [
    { label: '9:16', value: '9:16', desc: 'Shorts/Reels', icon: 'crop_portrait' },
    { label: '16:9', value: '16:9', desc: 'YouTube', icon: 'crop_landscape' },
    { label: '1:1', value: '1:1', desc: 'Instagram', icon: 'crop_square' },
    { label: '4:5', value: '4:5', desc: 'Feed', icon: 'crop_din' },
  ];

  constructor(private api: ApiService) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    const validTypes = ['video/mp4', 'video/x-matroska', 'video/x-msvideo', 'video/quicktime', 'video/webm'];
    const validExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts', '.vob'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      this.errorMessage.set('Please select a valid video file (MP4, MKV, AVI, etc).');
      return;
    }

    // 5GB limit
    if (file.size > 5000 * 1024 * 1024) {
      this.errorMessage.set('File size exceeds 5GB limit.');
      return;
    }

    this.selectedFile.set(file);
    this.errorMessage.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.uploadProgress.set(0);
    this.uploadComplete.set(false);
    this.errorMessage.set(null);
  }

  // Setters for UI
  setClippingMode(val: string) { this.clippingMode.set(val as 'smart' | 'fixed' | 'subtitle_only'); }
  setContentMode(val: string) { this.contentMode.set(val); }
  setDuration(val: number) { this.clipDuration.set(val); }
  setAspectRatio(val: string) { this.aspectRatio.set(val); }
  setCropMode(val: string) { this.cropMode.set(val); }
  setSubtitleStyle(val: string) { this.subtitleStyle.set(val); }
  setEffectsLevel(val: string) { this.effectsLevel.set(val as 'low' | 'medium' | 'aggressive'); }
  toggleSubtitles() { this.addSubtitles.set(true); }
  toggleBroll() { this.enableBroll.set(!this.enableBroll()); }
  toggleAudio() { this.enableAudio.set(!this.enableAudio()); }
  toggleSfx() { this.enableSfx.set(!this.enableSfx()); }
  toggleBgm() { this.enableBgm.set(!this.enableBgm()); }

  startUpload(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.errorMessage.set(null);

    this.api.uploadVideo(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
          this.uploadProgress.set(progress);
        } else if (event.type === HttpEventType.Response) {
          const body = event.body;
          if (body) {
            this.isUploading.set(false);
            this.uploadComplete.set(true);
            this.uploadProgress.set(100);
            this.startProcessing(body.jobId);
          }
        }
      },
      error: (err) => {
        this.isUploading.set(false);
        this.errorMessage.set(err.error?.message || 'Upload failed. Please try again.');
        console.error('Upload error:', err);
      }
    });
  }

  private startProcessing(jobId: string): void {
    this.isProcessing.set(true);

    const options = {
      clippingMode: this.clippingMode(),
      mode: this.clippingMode() === 'smart' ? this.contentMode() : undefined,
      clipDuration: this.clipDuration(),
      aspectRatio: this.aspectRatio(),
      cropMode: this.cropMode(),
      addSubtitles: true,
      enableBroll: this.enableBroll(),
      enableAudio: this.enableAudio(),
      enableSfx: this.enableSfx(),
      enableBgm: this.enableBgm(),
      effectsLevel: this.effectsLevel(),
      musicVolume: this.musicVolume(),
      subtitleStyle: this.subtitleStyle()
    };

    this.api.startProcessing(jobId, options).subscribe({
      next: () => {
        this.isProcessing.set(false);
        this.jobStarted.emit(jobId);
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to start processing.');
        console.error('Process error:', err);
      }
    });
  }
}
