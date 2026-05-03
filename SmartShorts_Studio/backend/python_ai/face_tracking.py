def track_faces(video_path: str) -> dict:
    try:
        import cv2
        import mediapipe as mp
    except Exception as exc:
        return {"success": False, "error": str(exc), "face_found": False, "track": []}

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"success": False, "error": "Cannot open video", "face_found": False, "track": []}

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_skip = max(1, int(fps / 2))
    track = []

    with mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5) as detector:
        frame_index = 0
        while cap.isOpened():
            ok, frame = cap.read()
            if not ok:
                break
            if frame_index % frame_skip == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = detector.process(rgb)
                if result.detections:
                    box = result.detections[0].location_data.relative_bounding_box
                    x_ratio = max(0.0, min(1.0, box.xmin + box.width / 2))
                    track.append({"time": frame_index / fps, "x_ratio": x_ratio})
            frame_index += 1

    cap.release()
    if not track:
        return {"success": True, "face_found": False, "target_x_ratio": 0.5, "track": []}

    avg_x = sum(point["x_ratio"] for point in track) / len(track)
    return {
        "success": True,
        "face_found": True,
        "target_x_ratio": avg_x,
        "source_width": width,
        "track": track,
    }
