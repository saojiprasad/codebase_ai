import { Component, signal } from '@angular/core';
import { Header } from './components/header/header';
import { Upload } from './components/upload/upload';
import { Clips } from './components/clips/clips';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Header, Upload, Clips],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  /** The active job ID, set after upload + process starts */
  activeJobId = signal<string | null>(null);

  onJobStarted(jobId: string): void {
    this.activeJobId.set(jobId);

    // Smooth scroll to clips section
    setTimeout(() => {
      document.getElementById('clips-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 300);
  }

  resetApp(): void {
    this.activeJobId.set(null);
  }
}
