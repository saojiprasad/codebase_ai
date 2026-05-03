import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SseService {

  constructor(private zone: NgZone) {}

  /**
   * Connect to an SSE stream and return an Observable of parsed JSON events.
   * Handles the 'update' event.
   */
  connectToJob(jobId: string): Observable<any> {
    return new Observable(observer => {
      const eventSource = new EventSource(`http://localhost:3000/api/events/${jobId}`);

      eventSource.addEventListener('update', (event: MessageEvent) => {
        this.zone.run(() => {
          try {
            const data = JSON.parse(event.data);
            observer.next(data);
            
            // Close connection when terminal state is reached
            if (data.status === 'completed' || data.status === 'failed') {
              eventSource.close();
              observer.complete();
            }
          } catch (e) {
            console.error('Error parsing SSE data', e);
          }
        });
      });

      eventSource.onerror = (error) => {
        this.zone.run(() => {
          console.error('SSE Error:', error);
          eventSource.close();
          observer.error(error);
        });
      };

      return () => {
        eventSource.close();
      };
    });
  }
}
