import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Clip, JobStatus } from '../../services/api.service';
import { SseService } from '../../services/sse.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-clips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clips.html',
  styleUrl: './clips.scss'
})
export class Clips implements OnInit, OnDestroy {
  @Input() jobId: string = '';

  status = signal<JobStatus | null>(null);
  pollError = signal<string | null>(null);

  private sseSub: Subscription | null = null;

  constructor(private api: ApiService, private sse: SseService) {}

  ngOnInit(): void {
    if (this.jobId) {
      this.startListening();
    }
  }

  ngOnDestroy(): void {
    if (this.sseSub) {
      this.sseSub.unsubscribe();
    }
  }

  startListening(): void {
    // Initial fetch to ensure we don't miss anything while connecting
    this.api.getStatus(this.jobId).subscribe(data => {
      this.status.set(data);
    });

    // Connect to SSE stream
    this.sseSub = this.sse.connectToJob(this.jobId).subscribe({
      next: (data) => {
        this.status.set(data);
        this.pollError.set(null);
      },
      error: (err) => {
        console.error('SSE connection lost', err);
        // Could fallback to polling here if needed
      }
    });
  }

  getStreamUrl(clip: Clip): string {
    return this.api.getStreamUrl(clip);
  }

  getDownloadUrl(clip: Clip): string {
    return this.api.getDownloadUrl(this.jobId, clip.name);
  }

  getAssetUrl(path: string | undefined): string {
    return path ? `http://localhost:3000${path}` : '';
  }

  downloadClip(clip: Clip): void {
    const url = this.getDownloadUrl(clip);
    const a = document.createElement('a');
    a.href = url;
    a.download = clip.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  downloadAll(): void {
    const clips = this.status()?.clips || [];
    clips.forEach((clip, index) => {
      setTimeout(() => this.downloadClip(clip), index * 500);
    });
  }

  async copyToClipboard(text: string | undefined) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      console.log('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  getStatusIcon(): string {
    const s = this.status()?.status;
    switch (s) {
      case 'processing': return 'sync';
      case 'completed': return 'check_circle';
      case 'failed': return 'error';
      default: return 'hourglass_empty';
    }
  }

  getStatusLabel(): string {
    const s = this.status()?.status;
    switch (s) {
      case 'processing': return 'Generating Magic Clips...';
      case 'completed': return 'Complete!';
      case 'failed': return 'Failed';
      default: return 'Waiting...';
    }
  }

  getPipelineStepLabel(): string {
    const data = this.status();
    if (!data) return '';
    return data.currentStepDescription || 'Processing...';
  }

  getViralGradeColor(score: number): string {
    if (!score) return '#888';
    if (score >= 80) return '#ff3b30'; // S / Red-orange hot
    if (score >= 65) return '#ff9500'; // A / Orange
    if (score >= 50) return '#ffd60a'; // B / Yellow
    return '#34c759'; // Green ok
  }

  getScore(clip: Clip, key: keyof NonNullable<Clip['details']>): number {
    return Math.round(clip.details?.[key] || 0);
  }

  getHashtags(clip: Clip): string {
    return (clip.hashtags || clip.seo?.hashtags || []).join(' ');
  }

  getTimelineSummary(clip: Clip): string {
    const resets = clip.editPlan?.pacing?.attentionResetCount || clip.assetTimeline?.filter(event => event.type === 'flash' || event.effect === 'attention_reset').length || 0;
    const mood = clip.editPlan?.mood || 'auto';
    const music = clip.editPlan?.audio?.musicMood || 'balanced';
    const sfx = clip.assetTimeline?.filter(event => event.type === 'sfx' || event.sound).length || 0;
    return `${mood} edit, ${resets} resets, ${sfx} SFX, ${music} music`;
  }

  getTimelineEvents(clip: Clip): NonNullable<Clip['assetTimeline']> {
    return (clip.assetTimeline || []).slice(0, 10);
  }

  getEventLabel(event: NonNullable<Clip['assetTimeline']>[number]): string {
    if (typeof event.sound === 'string') return `SFX ${event.sound}`;
    if (event.sound && typeof event.sound === 'object') return `SFX ${event.sound.name}`;
    if (event.emoji) return `Emoji ${event.emoji}`;
    return event.type || event.effect || 'effect';
  }

  formatDuration(seconds: string | number): string {
    const s = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }
}
