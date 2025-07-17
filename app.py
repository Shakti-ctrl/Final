from flask import Flask, render_template_string, request, redirect, send_file, session, url_for, jsonify
import subprocess
import os
import json
import threading
import time
from werkzeug.utils import secure_filename
import zipfile
import requests
from urllib.parse import urlparse, urlunparse
import os

app = Flask(__name__)
app.secret_key = 'securekey123'

# Directories
WORK_DIR = os.path.expanduser("~/ncert_audio_web")
AUDIO_DIR = os.path.join(WORK_DIR, "audio")
TMP_DIR = os.path.join(WORK_DIR, "temp")
UPLOAD_DIR = os.path.join(WORK_DIR, "uploads")
LOG_FILE = os.path.join(WORK_DIR, "log.txt")

os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(TMP_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

USERS = {'admin': 'password123'}

YOUTUBE_API_KEY = 'AIzaSyDDdnn2fHx94y0eAWUSxOC8SzvZvxmOpdA'

# Global extraction control flags per user session (simple implementation)
extraction_threads = {}
extraction_paused = {}

def log(msg):
    with open(LOG_FILE, 'a') as f:
        f.write(f"{msg}\n")

def get_channel_id(channel_url):
    parsed = urlparse(channel_url)
    path = parsed.path.strip('/')

    if '@ncert_audio_books' in channel_url:
        return 'UCysEngjfeIYapEER9K8aikw'

    if path.startswith('channel/'):
        return path.split('/')[1]
    elif path.startswith('user/'):
        username = path.split('/')[1]
        url = f'https://www.googleapis.com/youtube/v3/channels?key={YOUTUBE_API_KEY}&forUsername={username}&part=id'
        resp = requests.get(url).json()
        if 'items' in resp and len(resp['items']) > 0:
            return resp['items'][0]['id']
        return None
    elif path.startswith('@'):
        handle = path
        search_url = f'https://www.googleapis.com/youtube/v3/search?key={YOUTUBE_API_KEY}&part=snippet&type=channel&q={handle}'
        resp = requests.get(search_url).json()
        if 'items' in resp and resp['items']:
            for item in resp['items']:
                if item['snippet']['channelTitle'].lower() == handle[1:].lower():
                    return item['snippet']['channelId']
            return resp['items'][0]['snippet']['channelId']
        return None
    else:
        if len(path) == 24 and path.startswith('UC'):
            return path
    return None

def search_videos_youtube_api(channel_url, page_token=''):
    channel_id = get_channel_id(channel_url)
    if not channel_id:
        log(f"❌ Could not determine channel ID from URL: {channel_url}")
        return [], None, 0  # videos, next_page_token, quota_remaining

    log(f"🔎 Searching videos for channel ID: {channel_id}, page token: {page_token}")

    api_url = (
        f'https://www.googleapis.com/youtube/v3/search?key={YOUTUBE_API_KEY}'
        f'&channelId={channel_id}&part=snippet&order=date&maxResults=50&pageToken={page_token}'
        f'&type=video'
    )
    resp = requests.get(api_url).json()
    if 'error' in resp:
        log(f"❌ YouTube API error: {resp['error']}")
        return [], None, None

    videos = []
    items = resp.get('items', [])
    for item in items:
        video_id = item['id']['videoId']
        title = item['snippet']['title']
        videos.append({'id': video_id, 'title': title})

    next_token = resp.get('nextPageToken')
    quota_remaining = resp.get('quotaRemaining', None)  # Quota info often unavailable here
    return videos, next_token, quota_remaining

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        u = request.form['username']
        p = request.form['password']
        if USERS.get(u) == p:
            session['user'] = u
            session.pop('video_cache', None)
            return redirect('/')
        return "Invalid credentials", 401
    return '''
<form method="post">      
<input name="username" placeholder="Username" required><br>      
<input type="password" name="password" placeholder="Password" required><br>      
<button type="submit">Login</button>      
</form>'''

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

@app.route('/', methods=['GET', 'POST'])
def index():
    if 'user' not in session:
        return redirect('/login')

    user = session['user']
    channel_url = request.form.get("channel_url") or request.args.get("channel_url") or "https://www.youtube.com/@ncert_audio_books"
    bot_token = request.form.get("bot_token") or session.get("bot_token", "")
    chat_id = request.form.get("chat_id") or session.get("chat_id", "")
    page_token = request.args.get("page_token", "")

    audio_format = request.form.get('audio_format') or 'mp3'
    playback_speed = request.form.get('playback_speed') or '1.0'

    if request.method == 'POST':
        session['bot_token'] = bot_token
        session['chat_id'] = chat_id

        if 'search' in request.form:
            videos, next_token, quota = search_videos_youtube_api(channel_url, page_token='')
            session['video_cache'] = videos
            session['channel_url'] = channel_url
            session['next_page_token'] = next_token
            session['api_quota'] = quota

        elif 'next_page' in request.form:
            token = session.get('next_page_token', '')
            channel_url_cached = session.get('channel_url', channel_url)
            videos, next_token, quota = search_videos_youtube_api(channel_url_cached, token)
            session['video_cache'] = videos
            session['next_page_token'] = next_token
            session['channel_url'] = channel_url_cached
            session['api_quota'] = quota

        elif 'extract' in request.form:
            selected_ids = request.form.getlist("videos")
            send_full_video = 'send_full_video' in request.form
            # Track extraction thread to allow pause/resume
            th = threading.Thread(target=download_and_forward, args=(user, selected_ids, bot_token, chat_id, send_full_video, audio_format))
            th.daemon = True
            extraction_threads[user] = th
            extraction_paused[user] = False
            th.start()

        elif 'single_video_download' in request.form:
            video_url = request.form.get("single_video_url")
            send_full_video = request.form.get("single_send_full_video") == 'on'
            single_audio_format = request.form.get("single_audio_format") or 'mp3'
            th = threading.Thread(target=download_and_forward_single_video, args=(user, video_url, bot_token, chat_id, send_full_video, single_audio_format))
            th.daemon = True
            extraction_threads[user] = th
            extraction_paused[user] = False
            th.start()

        elif 'upload_bot' in request.form:
            file = request.files['uploadfile']
            filename = secure_filename(file.filename)
            path = os.path.join(TMP_DIR, filename)
            file.save(path)
            threading.Thread(target=send_uploaded_file_to_bot, args=(path, bot_token, chat_id)).start()

        elif 'delete_audio' in request.form:
            file_to_delete = request.form.get('delete_audio')
            file_path = os.path.join(AUDIO_DIR, file_to_delete)
            if os.path.exists(file_path) and file_to_delete.endswith('.mp3'):
                try:
                    os.remove(file_path)
                    log(f"🗑️ Deleted audio file: {file_to_delete}")
                except Exception as e:
                    log(f"❌ Failed to delete {file_to_delete}: {e}")
            return redirect('/')

        elif 'pause_extraction' in request.form:
            if user in extraction_paused:
                extraction_paused[user] = True
                log(f"⏸️ Extraction paused by user {user}")
            return redirect('/')

        elif 'resume_extraction' in request.form:
            if user in extraction_paused:
                extraction_paused[user] = False
                log(f"▶️ Extraction resumed by user {user}")
            return redirect('/')

        elif 'rename_audio' in request.form:
            old_name = request.form.get('old_name')
            new_name = request.form.get('new_name')
            if old_name and new_name:
                old_path = os.path.join(AUDIO_DIR, old_name)
                if not new_name.lower().endswith('.mp3'):
                    new_name += '.mp3'
                new_path = os.path.join(AUDIO_DIR, new_name)
                if os.path.exists(old_path):
                    try:
                        os.rename(old_path, new_path)
                        log(f"✏️ Renamed {old_name} to {new_name}")
                    except Exception as e:
                        log(f"❌ Rename error: {e}")
            return redirect('/')

        elif 'toggle_dark_mode' in request.form:
            current = session.get('dark_mode', False)
            session['dark_mode'] = not current
            return redirect('/')

        return redirect(url_for('index'))

    videos = session.get('video_cache', [])
    next_token = session.get('next_page_token', None)
    quota = session.get('api_quota', 'N/A')
    dark_mode = session.get('dark_mode', False)

    audio_files = sorted([f for f in os.listdir(AUDIO_DIR) if f.endswith(".mp3")])

    with open(LOG_FILE, 'r') as f:
        logs = f.read()

    return render_template_string(TEMPLATE,
                                  videos=videos,
                                  audio_files=audio_files,
                                  log=logs,
                                  channel_url=channel_url,
                                  bot_token=bot_token,
                                  chat_id=chat_id,
                                  next_page_token=next_token,
                                  api_quota=quota,
                                  dark_mode=dark_mode,
                                  playback_speed=playback_speed,
                                  audio_format=audio_format)

@app.route('/log')
def get_log():
    with open(LOG_FILE, 'r') as f:
        return f.read()

@app.route('/play/<filename>')
def play_audio(filename):
    path = os.path.join(AUDIO_DIR, filename)
    if not os.path.exists(path):
        return "File not found", 404
    return send_file(path)

@app.route('/download/<filename>')
def download_audio(filename):
    path = os.path.join(AUDIO_DIR, filename)
    if not os.path.exists(path):
        return "File not found", 404
    return send_file(path, as_attachment=True)

@app.route('/download_zip', methods=['POST'])
def download_zip():
    selected = request.form.getlist("files")
    if not selected:
        return redirect('/')
    zip_path = os.path.join(WORK_DIR, "audios.zip")
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for file in selected:
            zipf.write(os.path.join(AUDIO_DIR, file), arcname=file)
    return send_file(zip_path, as_attachment=True)

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)
    threading.Thread(target=extract_audio_from_file, args=(filepath,)).start()
    return redirect('/')

def extract_audio_from_file(filepath):
    title = os.path.splitext(os.path.basename(filepath))[0]
    out_path = os.path.join(AUDIO_DIR, f"{title}.mp3")
    log(f"🎞️ Extracting from file: {filepath}")
    subprocess.run(f"ffmpeg -i '{filepath}' -q:a 0 -map a '{out_path}'", shell=True)
    os.remove(filepath)
    log(f"✅ Extracted and saved: {out_path}")

def wait_for_unpause(user):
    while extraction_paused.get(user, False):
        time.sleep(1)

def download_and_forward(user, video_ids, bot_token, chat_id, send_full_video=False, audio_format='mp3'):
    log("📥 Starting download and forward...")
    for vid in video_ids:
        wait_for_unpause(user)
        url = f"https://www.youtube.com/watch?v={vid}"
        log(f"🔗 Downloading: {url}")
        if send_full_video:
            cmd = f"yt-dlp -f best -o '{TMP_DIR}/%(title)s.%(ext)s' {url}"
        else:
            cmd = (f"yt-dlp -x --audio-format {audio_format} --embed-thumbnail --add-metadata "
                   f"-o '{TMP_DIR}/%(title)s.%(ext)s' {url}")
        subprocess.run(cmd, shell=True)

        # After each video removal of TMP files and forwarding below

    for file in os.listdir(TMP_DIR):
        wait_for_unpause(user)
        path = os.path.join(TMP_DIR, file)
        if send_full_video and file.endswith(('.mp4', '.mkv', '.webm')):
            log(f"📤 Forwarding full video: {file}")
            subprocess.run([
                "curl", "-s", "-X", "POST",
                f"https://api.telegram.org/bot{bot_token}/sendVideo",
                "-F", f"chat_id={chat_id}",
                "-F", f"video=@{path}",
                "-F", f"caption=🎞️ {file}"
            ])
            try:
                os.remove(path)
            except:
                pass
        elif (not send_full_video) and file.lower().endswith(f".{audio_format}"):
            dest_path = os.path.join(AUDIO_DIR, file)
            try:
                if os.path.exists(dest_path):
                    os.remove(dest_path)
                os.rename(path, dest_path)
                log(f"✅ Moved extracted audio to {dest_path}")
                subprocess.run([
                    "curl", "-s", "-X", "POST",
                    f"https://api.telegram.org/bot{bot_token}/sendAudio",
                    "-F", f"chat_id={chat_id}",
                    "-F", f"audio=@{dest_path}",
                    "-F", f"title={file}",
                    "-F", f"performer=NCERT Audio Book"
                ])
            except Exception as e:
                log(f"❌ Error moving or sending audio {file}: {e}")
        else:
            try:
                os.remove(path)
            except Exception:
                pass

    log("🎉 All done.")

def download_and_forward_single_video(user, video_url, bot_token, chat_id, send_full_video=False, audio_format='mp3'):
    log(f"📥 Starting single video download and forward: {video_url}")
    wait_for_unpause(user)
    if send_full_video:
        cmd = f"yt-dlp -f best -o '{TMP_DIR}/%(title)s.%(ext)s' {video_url}"
    else:
        cmd = (f"yt-dlp -x --audio-format {audio_format} --embed-thumbnail --add-metadata "
               f"-o '{TMP_DIR}/%(title)s.%(ext)s' {video_url}")
    subprocess.run(cmd, shell=True)

    for file in os.listdir(TMP_DIR):
        wait_for_unpause(user)
        path = os.path.join(TMP_DIR, file)
        if send_full_video and file.endswith(('.mp4', '.mkv', '.webm')):
            log(f"📤 Forwarding full video: {file}")
            subprocess.run([
                "curl", "-s", "-X", "POST",
                f"https://api.telegram.org/bot{bot_token}/sendVideo",
                "-F", f"chat_id={chat_id}",
                "-F", f"video=@{path}",
                "-F", f"caption=🎞️ {file}"
            ])
            try:
                os.remove(path)
            except:
                pass
        elif (not send_full_video) and file.lower().endswith(f".{audio_format}"):
            dest_path = os.path.join(AUDIO_DIR, file)
            try:
                if os.path.exists(dest_path):
                    os.remove(dest_path)
                os.rename(path, dest_path)
                log(f"✅ Moved extracted audio to {dest_path}")
                subprocess.run([
                    "curl", "-s", "-X", "POST",
                    f"https://api.telegram.org/bot{bot_token}/sendAudio",
                    "-F", f"chat_id={chat_id}",
                    "-F", f"audio=@{dest_path}",
                    "-F", f"title={file}",
                    "-F", f"performer=NCERT Audio Book"
                ])
            except Exception as e:
                log(f"❌ Error moving or sending audio {file}: {e}")
        else:
            try:
                os.remove(path)
            except Exception:
                pass

    log("🎉 Single video download done.")

def send_uploaded_file_to_bot(path, bot_token, chat_id):
    filename = os.path.basename(path)
    log(f"🚀 Uploading file to bot: {filename}")
    subprocess.run([
        "curl", "-s", "-X", "POST",
        f"https://api.telegram.org/bot{bot_token}/sendDocument",
        "-F", f"chat_id={chat_id}",
        "-F", f"document=@{path}",
        "-F", f"caption=📤 Uploaded File: {filename}"
    ])
    os.remove(path)
    log(f"✅ Uploaded and removed: {filename}")

# Updated TEMPLATE with tabs, dark mode, audio playback queue, batch rename modal, scrollable audio list & search, single video download tab
TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>NCERT Audio Extractor Extended</title>
<style>
  body {
    font-family: sans-serif;
    background: {{ '#121212' if dark_mode else '#f0f0f0' }};
    color: {{ 'white' if dark_mode else 'black' }};
    margin: 0; padding: 0; min-height: 100vh;
  }
  header {
    background: {{ '#1f1f1f' if dark_mode else '#0078d7' }};
    color: white; padding: 10px;
    text-align: center;
    font-size: 1.5rem;
  }
  nav {
    display: flex;
    justify-content: center;
    background: {{ '#222' if dark_mode else '#eee' }};
  }
  nav button {
    background: none;
    border: none;
    padding: 15px 30px;
    font-size: 1rem;
    cursor: pointer;
    color: {{ 'white' if dark_mode else 'black' }};
    border-bottom: 3px solid transparent;
    transition: border-color 0.3s ease;
  }
  nav button.active {
    border-bottom: 3px solid {{ '#00ffcc' if dark_mode else '#0078d7' }};
  }
  main {
    padding: 15px;
    max-width: 1200px;
    margin: auto;
  }
  .flex-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .flex-grow {
    flex-grow: 1;
  }
  .scrollable {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid {{ '#444' if dark_mode else '#ccc' }};
    background: {{ '#222' if dark_mode else 'white' }};
    padding: 10px;
  }
  input[type=text], input[type=url], select {
    width: 100%;
    padding: 7px;
    margin: 5px 0 10px;
    border: 1px solid {{ '#555' if dark_mode else '#ccc' }};
    border-radius: 4px;
    background: {{ '#333' if dark_mode else 'white' }};
    color: {{ 'white' if dark_mode else 'black' }};
  }
  button {
    background: {{ '#0078d7' if not dark_mode else '#00ffc8' }};
    border: none;
    color: white;
    padding: 8px 15px;
    font-size: 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  label {
    display: block;
    margin-top: 8px;
  }
  .video, .audio-file {
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid {{ '#444' if dark_mode else '#ddd' }};
    padding: 5px 0;
  }
  .video img.thumb {
    width: 100px;
    height: 56px;
    object-fit: cover;
    cursor: pointer;
  }
  .audio-file audio {
    width: 250px;
  }
  .audio-file .rename {
    margin-left: auto;
    cursor: pointer;
    color: {{ '#00ffcc' if dark_mode else '#0078d7' }};
  }
  .search-input {
    margin-bottom: 10px;
  }
  pre#logbox {
    background: {{ '#111' if dark_mode else '#eee' }};
    padding: 10px;
    max-height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    border-radius: 4px;
    border: 1px solid {{ '#444' if dark_mode else '#ccc' }};
  }
  .status-bar {
    background: {{ '#000' if dark_mode else '#222' }};
    color: {{ '#0f0' if dark_mode else '#afa' }};
    font-weight: bold;
    padding: 8px;
    margin-bottom: 10px;
  }
  progress {
    width: 100%;
    height: 20px;
    margin-bottom: 15px;
  }
  /* Modal for batch rename */
  #renameModal {
    display: none;
    position: fixed;
    z-index: 10000;
    left: 0; top: 0; width: 100%; height: 100%;
    background-color: rgba(0,0,0,0.7);
  }
  #renameModal .modal-content {
    background-color: {{ '#222' if dark_mode else 'white' }};
    margin: 15% auto;
    padding: 20px;
    border-radius: 8px;
    width: 90%;
    max-width: 400px;
    color: {{ 'white' if dark_mode else 'black' }};
  }
  #renameModal label {
    margin-bottom: 5px;
  }
  #renameModal input[type=text] {
    width: 100%;
    padding: 6px;
    font-size: 1rem;
  }
  #renameModal button {
    margin-top: 10px;
    width: 100%;
  }
  /* Responsive */
  @media (max-width: 700px) {
    .flex-row {
      flex-direction: column;
    }
    .audio-file audio {
      width: 100%;
    }
    nav button {
      padding: 10px 15px;
      font-size: 0.9rem;
    }
  }
</style>
</head>
<body>
<header>🎧 NCERT Audio Extractor Extended</header>
<nav>
  <button id="tab1Btn" class="active">Channel Videos</button>
  <button id="tab2Btn">Single Video Download</button>
  <button id="tab3Btn">Extracted Audios</button>
  <form method="post" style="margin-left:auto;">
    <input type="hidden" name="toggle_dark_mode" value="1" />
    <button type="submit"> {{ 'Light Mode' if dark_mode else 'Dark Mode' }} </button>
  </form>
</nav>
<main>
  <div id="tab1" class="tab-content">
    <form method="post" id="channelForm">

      <div class="flex-row">
        <input type="url" name="channel_url" required placeholder="YouTube channel link" value="{{ channel_url }}" class="flex-grow" />
        <input type="text" name="bot_token" placeholder="Telegram Bot Token" value="{{ bot_token }}" required />
        <input type="text" name="chat_id" placeholder="Chat ID" value="{{ chat_id }}" required />
      </div>

      <div class="flex-row" style="align-items:center;gap:15px;">
        <button type="submit" name="search">🔍 Search Videos</button>
        {% if next_page_token %}
          <button type="submit" name="next_page">➡️ Next Page</button>
        {% endif %}
        <label><input type="checkbox" name="send_full_video" /> Send full video instead of audio</label>
        <label>
          Audio Format:
          <select name="audio_format">
            <option value="mp3" {% if audio_format=='mp3' %}selected{% endif %}>MP3</option>
            <option value="wav" {% if audio_format=='wav' %}selected{% endif %}>WAV</option>
            <option value="aac" {% if audio_format=='aac' %}selected{% endif %}>AAC</option>
            <option value="m4a" {% if audio_format=='m4a' %}selected{% endif %}>M4A</option>
            <option value="opus" {% if audio_format=='opus' %}selected{% endif %}>Opus</option>
          </select>
        </label>
      </div>

      <input type="text" id="videoFilter" placeholder="Filter videos here..." class="search-input" />

      <label><input type="checkbox" id="selectAllVideos" /> Select All</label>
      <div class="scrollable" id="videoList">
        {% if videos %}
          {% for v in videos %}
          <div class="video" data-title="{{ v['title']|lower }}">
            <input type="checkbox" name="videos" value="{{ v['id'] }}" />
            <img src="https://i.ytimg.com/vi/{{ v['id'] }}/hqdefault.jpg" class="thumb" title="Play thumbnail" onclick="window.open('https://www.youtube.com/watch?v={{ v['id'] }}','_blank')" />
            <div style="flex-grow:1;">
              <strong>{{ v['title'] }}</strong><br />
              <a target="_blank" href="https://www.youtube.com/watch?v={{ v['id'] }}">▶️ Play</a>
            </div>
          </div>
          {% endfor %}
        {% else %}
          <p>No videos found or search not performed.</p>
        {% endif %}
      </div>

      <div class="flex-row" style="gap:10px; margin-top:10px;">
        <button type="submit" name="extract" id="extractBtn" disabled>🎵 Extract/Send</button>
        <button type="submit" name="pause_extraction">⏸️ Pause</button>
        <button type="submit" name="resume_extraction">▶️ Resume</button>
      </div>

      <div class="status-bar" id="statusBar">Status: Ready</div>
      <progress id="progressBar" max="100" hidden></progress>
      <div>API Quota Remaining: {{ api_quota }}</div>
    </form>
  </div>

  <div id="tab2" class="tab-content" style="display:none;">
    <form method="post" id="singleVideoForm">

      <label for="single_video_url">Single Video URL:</label>
      <input type="url" id="single_video_url" name="single_video_url" placeholder="https://youtube.com/watch?v=..." required />

      <label for="single_send_full_video"><input type="checkbox" id="single_send_full_video" name="single_send_full_video" /> Send full video instead of audio</label>

      <label for="single_audio_format">Audio Format:</label>
      <select id="single_audio_format" name="single_audio_format">
        <option value="mp3" selected>MP3</option>
        <option value="wav">WAV</option>
        <option value="aac">AAC</option>
        <option value="m4a">M4A</option>
        <option value="opus">Opus</option>
      </select>

      <div class="flex-row">
        <input type="text" name="bot_token" placeholder="Telegram Bot Token" value="{{ bot_token }}" required/>
        <input type="text" name="chat_id" placeholder="Chat ID" value="{{ chat_id }}" required/>
      </div>

      <button type="submit" name="single_video_download">Download / Extract</button>

    </form>
  </div>

  <div id="tab3" class="tab-content" style="display:none;">
    <input type="text" id="audioFilter" placeholder="Filter extracted audio files..." class="search-input" />

    <div class="scrollable" id="audioList">
      {% if audio_files %}
      <form method="post" id="audioControlsForm">
        {% for f in audio_files %}
        <div class="audio-file" datatitle="{{ f|lower }}">
          <b>{{ f }}</b>
          <audio src="/play/{{ f }}" controls preload="none" data-filename="{{ f }}" playbackrate="{{ playback_speed }}"></audio>
          <button type="button" class="rename-btn" data-filename="{{ f }}">Rename</button>
          <button type="submit" name="delete_audio" value="{{ f }}" onclick="return confirm('Delete {{ f }}?');" style="background:#c33;">Delete</button>
          <a href="/download/{{ f }}">⬇️ Download</a>
        </div>
        {% endfor %}
        <button type="submit" form="downloadZipForm">⬇️ Download ZIP of Selected</button>
      </form>

      <form id="downloadZipForm" method="POST" action="/download_zip" style="margin-top:10px;">
        {% for f in audio_files %}
          <input type="checkbox" name="files" value="{{ f }}" id="file_{{ loop.index0 }}" />
          <label for="file_{{ loop.index0 }}">{{ f }}</label><br />
        {% endfor %}
      </form>

      <label for="playback_speed_select">Playback Speed:</label>
      <select id="playback_speed_select" name="playback_speed">
        {% for spd in ['0.5','0.75','1','1.25','1.5','2'] %}
          <option value="{{ spd }}" {% if playback_speed == spd %}selected{% endif %}>{{ spd }}x</option>
        {% endfor %}
      </select>
      {% else %}
      <p>No extracted audio files.</p>
      {% endif %}
    </div>

    <h3>Upload Local Video and Extract Audio</h3>
    <form method="POST" action="/upload" enctype="multipart/form-data">
      <input type="file" name="file" accept="video/*" required />
      <button type="submit">Upload and Extract</button>
    </form>

    <h3>Upload Any File to Telegram Bot</h3>
    <form method="POST" enctype="multipart/form-data">
      <input type="file" name="uploadfile" required />
      <input type="text" name="bot_token" placeholder="Bot Token" value="{{ bot_token }}" required />
      <input type="text" name="chat_id" placeholder="Chat ID" value="{{ chat_id }}" required />
      <button type="submit" name="upload_bot">Send File to Bot</button>
    </form>

    <h3>Log Output</h3>
    <pre id="logbox">{{ log }}</pre>
  </div>

  <!-- Rename modal -->
  <div id="renameModal">
    <div class="modal-content">
      <h3>Rename Audio File</h3>
      <form method="post" id="renameForm">
        <input type="hidden" name="old_name" id="old_name" />
        <label for="new_name">New Name (with or without .mp3):</label>
        <input id="new_name" name="new_name" type="text" pattern=".*\.mp3$|[^.]+$" required />
        <button type="submit" name="rename_audio">Rename</button>
        <button type="button" id="renameCancel">Cancel</button>
      </form>
    </div>
  </div>
</main>

<script>
  // Tab switching
  const tab1Btn = document.getElementById('tab1Btn')
  const tab2Btn = document.getElementById('tab2Btn')
  const tab3Btn = document.getElementById('tab3Btn')
  const tab1 = document.getElementById('tab1')
  const tab2 = document.getElementById('tab2')
  const tab3 = document.getElementById('tab3')

  function setActiveTab(tabIndex) {
    tab1.style.display = (tabIndex === 1) ? 'block' : 'none'
    tab2.style.display = (tabIndex === 2) ? 'block' : 'none'
    tab3.style.display = (tabIndex === 3) ? 'block' : 'none'
    tab1Btn.classList.toggle('active', tabIndex === 1)
    tab2Btn.classList.toggle('active', tabIndex === 2)
    tab3Btn.classList.toggle('active', tabIndex === 3)
  }

  tab1Btn.onclick = () => setActiveTab(1)
  tab2Btn.onclick = () => setActiveTab(2)
  tab3Btn.onclick = () => setActiveTab(3)
  setActiveTab(1)

  // Video filter
  document.getElementById('videoFilter').addEventListener('input', (e) => {
    const filter = e.target.value.toLowerCase()
    document.querySelectorAll('#videoList .video').forEach(div => {
      div.style.display = div.dataset.title.includes(filter) ? 'flex' : 'none'
    })
  })

  // Select/deselect all videos
  document.getElementById('selectAllVideos').addEventListener('change', (e) => {
    const checked = e.target.checked
    document.querySelectorAll('input[name="videos"]').forEach(cb => cb.checked = checked)
    updateExtractButton()
  })

  // Enable extract button only if videos selected
  function updateExtractButton() {
    const anyChecked = Array.from(document.querySelectorAll('input[name="videos"]')).some(cb => cb.checked)
    document.getElementById('extractBtn').disabled = !anyChecked
  }
  document.querySelectorAll('input[name="videos"]').forEach(cb => {
    cb.addEventListener('change', updateExtractButton)
  })
  updateExtractButton()

  // Audio files filter
  document.getElementById('audioFilter').addEventListener('input', (e) => {
    const filter = e.target.value.toLowerCase()
    document.querySelectorAll('#audioList .audio-file').forEach(div => {
      div.style.display = div.getAttribute('dataTitle').includes(filter) ? 'flex' : 'none'
    })
  })

  // Rename modal logic
  const renameModal = document.getElementById('renameModal')
  const renameForm = document.getElementById('renameForm')
  const oldNameInput = document.getElementById('old_name')
  const newNameInput = document.getElementById('new_name')
  const renameCancelBtn = document.getElementById('renameCancel')

  document.querySelectorAll('.rename-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      oldNameInput.value = btn.dataset.filename
      newNameInput.value = btn.dataset.filename
      renameModal.style.display = 'block'
      newNameInput.focus()
    })
  })

  renameCancelBtn.onclick = () => {
    renameModal.style.display = 'none'
  }

  window.onclick = function(event) {
    if (event.target == renameModal) {
      renameModal.style.display = 'none'
    }
  }

  // Playback speed control - update all audio elements
  const playbackSpeedSelect = document.getElementById('playback_speed_select')
  if (playbackSpeedSelect) {
    playbackSpeedSelect.onchange = e => {
      const speed = parseFloat(e.target.value)
      document.querySelectorAll('#audioList audio').forEach(audio => {
        audio.playbackRate = speed
      })
      // Optionally submit form to save server session playback speed if you add that backend
    }
    // Initialize playback speed on load
    window.onload = () => {
      const speed = parseFloat(playbackSpeedSelect.value)
      document.querySelectorAll('#audioList audio').forEach(audio => { audio.playbackRate = speed })
    }
  }

  // Periodic log update
  setInterval(() => {
    fetch('/log').then(r => r.text()).then(txt => {
      const logbox = document.getElementById('logbox')
      if (logbox.innerText !== txt) {
        logbox.innerText = txt
      }
      if (txt.includes("🎉 All done.") || txt.includes("✅ Uploaded and removed") || txt.includes("🗑️ Deleted audio file")) {
        document.getElementById('progressBar').hidden = true
        document.getElementById('statusBar').innerText = '✅ Task Finished'
      }
    })
  }, 4000)

  // Show working status on form submit
  document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", () => {
      const statusBar = document.getElementById('statusBar')
      if(statusBar){
        statusBar.innerText = '⏳ Working...'
      }
      const progressBar = document.getElementById('progressBar')
      if(progressBar){
        progressBar.hidden = false
        progressBar.value = 50
      }
    })
  })
</script>
</body>
</html>
'''

if __name__ == '__main__':
    open(LOG_FILE, 'w').close()
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port)
