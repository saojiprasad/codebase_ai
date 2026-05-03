# Local music library

Place royalty-free or licensed background music here. SmartShorts Studio selects tracks by mood when filenames match these names:

```text
hype.mp3
upbeat.mp3
lofi.mp3
cinematic.mp3
inspire.mp3
suspense.mp3
dark.mp3
fun.mp3
meme.mp3
premium.mp3
```

If no matching file exists, the renderer checks `backend/assets/lofi_beat.mp3`, then the first `.mp3` in this folder. If no music is available, it skips music and keeps voice/SFX audio.
