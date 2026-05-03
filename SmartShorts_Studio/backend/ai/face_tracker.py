import cv2
import mediapipe as mp
import sys
import json

def get_face_center(video_path):
    """
    Analyzes a video to find the center of the face throughout the video.
    Returns a JSON string containing the average X coordinate for cropping.
    """
    mp_face_detection = mp.solutions.face_detection
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(json.dumps({"error": "Cannot open video"}))
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # We don't need to process every single frame, maybe 1 frame per second to be fast
    frame_skip = max(1, int(fps)) 
    
    face_centers_x = []
    
    with mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as face_detection:
        frame_idx = 0
        while cap.isOpened():
            success, image = cap.read()
            if not success:
                break
                
            if frame_idx % frame_skip == 0:
                # Convert the BGR image to RGB
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                results = face_detection.process(image_rgb)
                
                if results.detections:
                    # Get the most prominent face
                    detection = results.detections[0]
                    bboxC = detection.location_data.relative_bounding_box
                    # Calculate center X
                    cx = int((bboxC.xmin + bboxC.width / 2) * width)
                    
                    # Ensure it's within bounds
                    cx = max(0, min(width, cx))
                    face_centers_x.append(cx)
                    
            frame_idx += 1

    cap.release()
    
    if not face_centers_x:
        # Fallback to center if no face found
        print(json.dumps({
            "success": True,
            "target_x": width // 2,
            "target_x_ratio": 0.5,
            "source_width": width,
            "face_found": False
        }))
        return
        
    # Calculate average face center X to avoid jittery crops
    # A more advanced version would track it per frame and create dynamic panning
    avg_x = sum(face_centers_x) // len(face_centers_x)
    
    print(json.dumps({
        "success": True,
        "target_x": avg_x,
        "target_x_ratio": avg_x / width if width else 0.5,
        "source_width": width,
        "face_found": True
    }))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No video path provided"}))
        sys.exit(1)
        
    video_path = sys.argv[1]
    get_face_center(video_path)
