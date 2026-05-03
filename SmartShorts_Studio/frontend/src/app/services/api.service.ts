/**
 * API Service — Handles all HTTP communication with the backend.
 *
 * Provides methods for uploading videos, starting processing,
 * polling status, and retrieving clips.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UploadResponse {
  jobId: string;
  filename: string;
  size: string;
  status: string;
  message: string;
}

export interface ProcessResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface Clip {
  name: string;
  path: string;
  partNumber: number;
  size: string;
  sizeBytes: number;
  duration: string;
  start?: number;
  end?: number;
  viralScore?: number;
  grade?: string;
  hookText?: string;
  title?: string;
  description?: string;
  hashtags?: string[];
  reason?: string;
  emotion?: string;
  details?: {
    hookScore?: number;
    energyScore?: number;
    sceneScore?: number;
    pacingScore?: number;
    retentionScore?: number;
    engagementPrediction?: number;
    replayPotential?: number;
  };
  tips?: string[];
  thumbnails?: {
    shortsCover?: string;
    youtubeThumbnail?: string;
    instagramCover?: string;
  };
  editPlan?: {
    mood?: string;
    pacing?: {
      cutEverySeconds?: number;
      attentionResetCount?: number;
      retentionStrategy?: string;
    };
    audio?: {
      musicMood?: string;
      ducking?: boolean;
      cues?: unknown[];
    };
    visual?: {
      colorGrade?: string;
      zoomStyle?: string;
      effects?: unknown[];
    };
    broll?: unknown[];
    layers?: { type: string; name: string }[];
  };
  assetTimeline?: {
    type?: string;
    effect?: string;
    sound?: string | { name: string; path: string };
    emoji?: string;
    time: number;
    duration?: number;
    intensity?: number;
  }[];
  seo?: {
    title: string;
    description: string;
    hashtags: string[];
    cta?: string;
    platform?: Record<string, unknown>;
  };
}

export interface JobStatus {
  jobId: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalClips: number;
  processedClips: number;
  clips: Clip[];
  error: string | null;
  currentStep?: string;
  currentStepDescription?: string;
  pipelineSteps?: string[];
  analysis?: {
    totalDuration?: number;
    mode?: string;
    selectedMoments?: unknown[];
    timelinePreview?: {
      index: number;
      start: number;
      end: number;
      effects: unknown[];
    }[];
    metadata?: Record<string, unknown>;
  };
  thumbnails?: unknown[];
  titles?: string[];
  options?: Record<string, unknown>;
}

export interface ClipsResponse {
  jobId: string;
  status: string;
  totalClips: number;
  clips: Clip[];
}

const API_BASE = 'http://localhost:3000/api';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) {}

  /**
   * Upload a video file with progress tracking.
   * Returns an Observable of HttpEvents so we can track upload progress.
   */
  uploadVideo(file: File): Observable<HttpEvent<UploadResponse>> {
    const formData = new FormData();
    formData.append('video', file);

    const req = new HttpRequest('POST', `${API_BASE}/upload`, formData, {
      reportProgress: true,
    });

    return this.http.request<UploadResponse>(req);
  }

  /**
   * Start processing a previously uploaded video.
   */
  startProcessing(jobId: string, options: any): Observable<ProcessResponse> {
    return this.http.post<ProcessResponse>(`${API_BASE}/process`, {
      jobId,
      ...options
    });
  }

  /**
   * Get the current status of a job.
   */
  getStatus(jobId: string): Observable<JobStatus> {
    return this.http.get<JobStatus>(`${API_BASE}/status/${jobId}`);
  }

  /**
   * Get the list of clips for a completed job.
   */
  getClips(jobId: string): Observable<ClipsResponse> {
    return this.http.get<ClipsResponse>(`${API_BASE}/clips/${jobId}`);
  }

  /**
   * Get the download URL for a specific clip.
   */
  getDownloadUrl(jobId: string, clipName: string): string {
    return `${API_BASE}/download/${jobId}/${clipName}`;
  }

  /**
   * Get the streaming URL for a clip (served as static file).
   */
  getStreamUrl(clip: Clip): string {
    return `http://localhost:3000${clip.path}`;
  }
}
