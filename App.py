import eventlet
eventlet.monkey_patch()

import os
import json
import uuid
import hashlib
from datetime import datetime

from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client
from werkzeug.utils import secure_filename

load_dotenv()

# ─────────────────────────────────────────
# CONFIG BASE
# ─────────────────────────────────────────

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'cthulhu-secret')
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'static/uploads')
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB

CORS(app, supports_credentials=True)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    manage_session=True
)

# ─────────────────────────────────────────
# SUPABASE
# ─────────────────────────────────────────

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

supabase: Client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Supabase conectado")
    except Exception as e:
        print("❌ ERRO Supabase:", e)
else:
    print("⚠️ Rodando sem Supabase")

# ─────────────────────────────────────────
# UTILS
# ─────────────────────────────────────────

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def log_event(event_type, actor_name, description):
    if supabase:
        supabase.table('session_log').insert({
            'session_id': 'main',
            'event_type': event_type,
            'actor_name': actor_name,
            'description': description
        }).execute()

# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect('/login')
    return redirect('/game')

@app.route('/login', methods=['GET'])
def login_page():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    username = data.get('username')
    password = data.get('password')

    if not supabase:
        return jsonify({'error': 'DB offline'}), 500

    user = supabase.table('users').select('*').eq('username', username).execute().data

    if not user:
        return jsonify({'error': 'Usuário não existe'}), 401

    user = user[0]

    if user['password_hash'] != hash_password(password):
        return jsonify({'error': 'Senha incorreta'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    session['is_master'] = user['is_master']

    return jsonify({'success': True})

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

# ─────────────────────────────────────────
# GAME
# ─────────────────────────────────────────

@app.route('/game')
def game():
    if 'user_id' not in session:
        return redirect('/login')

    return render_template(
        'game.html',
        is_master=session.get('is_master', False)
    )

# ─────────────────────────────────────────
# CHARACTER
# ─────────────────────────────────────────

@app.route('/api/character')
def get_character():
    if 'user_id' not in session:
        return jsonify({'error': 'no auth'}), 401

    char = supabase.table('characters') \
        .select('*') \
        .eq('user_id', session['user_id']) \
        .execute().data

    if not char:
        return jsonify({'error': 'no character'}), 404

    char = char[0]

    skills = supabase.table('skills') \
        .select('*') \
        .eq('character_id', char['id']) \
        .execute().data

    return jsonify({
        'character': char,
        'skills': skills
    })

# ─────────────────────────────────────────
# MOVE
# ─────────────────────────────────────────

@app.route('/api/character/move', methods=['POST'])
def move_character():
    data = request.get_json()

    supabase.table('characters').update({
        'pos_x': data['pos_x'],
        'pos_y': data['pos_y'],
        'current_map': data['current_map'],
        'current_room': data['current_room']
    }).eq('user_id', session['user_id']).execute()

    socketio.emit('character_moved', {
        'user_id': session['user_id'],
        'pos_x': data['pos_x'],
        'pos_y': data['pos_y'],
        'current_map': data['current_map'],
        'current_room': data['current_room'],
        'image_url': data.get('image_url')
    }, room='main')

    return jsonify({'success': True})

# ─────────────────────────────────────────
# DICE
# ─────────────────────────────────────────

@app.route('/api/dice/roll', methods=['POST'])
def roll_dice():
    import random

    data = request.get_json()

    dice_map = {
        'd6': 6,
        'd10': 10,
        'd20': 20,
        'd100': 100
    }

    sides = dice_map.get(data['dice'], 20)
    result = random.randint(1, sides)

    payload = {
        'char_name': session.get('username'),
        'dice_type': data['dice'],
        'result': result
    }

    socketio.emit('dice_rolled', payload, room='main')

    return jsonify(payload)

# ─────────────────────────────────────────
# MONSTER MOVE (FIX IMPORTANTE)
# ─────────────────────────────────────────

@app.route('/api/monsters/move/<monster_id>', methods=['POST'])
def move_monster(monster_id):
    if not session.get('is_master'):
        return jsonify({'error': 'forbidden'}), 403

    data = request.get_json()

    supabase.table('monsters').update({
        'pos_x': data['pos_x'],
        'pos_y': data['pos_y']
    }).eq('id', monster_id).execute()

    socketio.emit('monster_moved', {
        'id': monster_id,
        'pos_x': data['pos_x'],
        'pos_y': data['pos_y']
    }, room='main')

    return jsonify({'success': True})

# ─────────────────────────────────────────
# SOCKET
# ─────────────────────────────────────────

@socketio.on('connect')
def connect():
    join_room('main')
    print("👤 usuário conectado")

@socketio.on('disconnect')
def disconnect():
    print("👤 usuário saiu")

# ─────────────────────────────────────────
# UPLOAD
# ─────────────────────────────────────────

@app.route('/api/upload', methods=['POST'])
def upload():
    file = request.files['file']

    filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
    path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    file.save(path)

    return jsonify({'url': f'/static/uploads/{filename}'})

# ─────────────────────────────────────────
# MAIN (PROD READY)
# ─────────────────────────────────────────

if __name__ == '__main__':
    os.makedirs('static/uploads', exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, debug=False, host='0.0.0.0', port=port)