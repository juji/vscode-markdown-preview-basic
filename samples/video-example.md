# Video Examples

Most videos don't work, only MP4 videos with MP3 sound works. VS Code is an Electron app, and Electron embeds Chromium for rendering, so its `<video>` support is whatever that bundled Chromium build supports — Ogg/Theora isn't supported at all. The MP4/MP3-audio claim is based on limited testing in this session, not a fully verified root cause.

## Remote video

<video src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" controls width="480"></video>

## Remote video (OGV)

<video src="https://download.blender.org/peach/trailer/trailer_400p.ogg" controls width="480"></video>

## Remote video (MP4)

<video src="https://download.blender.org/peach/trailer/trailer_iphone.m4v" controls width="480"></video>

## Local video (MP4, MP3 audio)

<video src="./big-buck-bunny_trailer-mp3audio.mp4" controls width="480"></video>

## YouTube embed

<iframe width="480" height="270" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allowfullscreen></iframe>

## Vimeo embed

<iframe width="480" height="270" src="https://player.vimeo.com/video/76979871" frameborder="0" allowfullscreen></iframe>

## Dailymotion embed

<iframe width="480" height="270" src="https://www.dailymotion.com/embed/video/x2jvvep" frameborder="0" allowfullscreen></iframe>
