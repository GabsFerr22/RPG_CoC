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
# UTILIDADES
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
    return render_template('Login.html')

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


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template('Registro.html')

    data = request.form
    username = data.get('username', '').strip()
    password = data.get('password', '')
    char_name = data.get('char_name', '').strip()

    if not username or not password or not char_name:
        return jsonify({'error': 'Campos obrigatórios faltando'}), 400

    existing = supabase.table('users').select('id').eq('username', username).execute()
    if existing.data:
        return jsonify({'error': 'Usuário já existe'}), 400

    image_url = '/static/images/default_character.png'
    file = request.files.get('char_image')

    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        storage_path = f"characters/{filename}"

        file_bytes = file.read()

        supabase.storage.from_("rpg_assets").upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": file.content_type,
                "upsert": "false"
            }
        )

        image_url = supabase.storage.from_("rpg_assets").get_public_url(storage_path)

    skills_json = data.get('skills_json', '[]')
    try:
        skills_data = json.loads(skills_json)
    except:
        skills_data = []

    user_res = supabase.table('users').insert({
        'username': username,
        'password_hash': hash_password(password),
        'is_master': False
    }).execute()

    user_id = user_res.data[0]['id']

    attributes = {
        'sanity': int(data.get('sanity', 50)),
        'sanity_max': int(data.get('sanity', 50)),
        'hp': int(data.get('hp', 10)),
        'hp_max': int(data.get('hp', 10)),
        'mp': int(data.get('mp', 10)),
        'mp_max': int(data.get('mp', 10)),
        'credit_rating': int(data.get('credit_rating', 0)),
        'movement': int(data.get('movement', 8)),
        'strength': int(data.get('strength', 50)),
        'constitution': int(data.get('constitution', 50)),
        'size': int(data.get('size', 50)),
        'dexterity': int(data.get('dexterity', 50)),
        'appearance': int(data.get('appearance', 50)),
        'intelligence': int(data.get('intelligence', 50)),
        'power': int(data.get('power', 50)),
        'education': int(data.get('education', 50)),
        'luck': int(data.get('luck', 50)),
    }

    char_res = supabase.table('characters').insert({
        'user_id': user_id,
        'name': char_name,
        'image_url': image_url,
        **attributes
    }).execute()

    char_id = char_res.data[0]['id']

    for skill in skills_data:
        supabase.table('skills').insert({
            'character_id': char_id,
            'name': skill.get('name', ''),
            'base_value': int(skill.get('base', 0)),
            'current_value': int(skill.get('value', 0)),
            'category': skill.get('category', 'general')
        }).execute()

    for i in range(10):
        supabase.table('inventory').insert({
            'character_id': char_id,
            'slot_index': i
        }).execute()

    return jsonify({'success': True, 'redirect': '/login'})

# ─────────────────────────────────────────
# JOGO
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
# PERSONAGEM
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
# MOV
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
# DADOS
# ─────────────────────────────────────────

@app.route('/api/dice/roll', methods=['POST'])
def roll_dice():
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401

    import random
    data = request.get_json()

    dice_type = data.get('dice', 'd100')
    purpose = data.get('purpose', '')
    char_name = data.get('char_name', session.get('username'))
    skill_value = data.get('skill_value')

    dice_map = {
        'd4': 4, 'd6': 6, 'd8': 8,
        'd10': 10, 'd12': 12,
        'd20': 20, 'd100': 100
    }

    sides = dice_map.get(dice_type, 100)
    result = random.randint(1, sides)

    success_level = None

    if skill_value is not None and dice_type == 'd100':
        skill = int(skill_value)

        if result <= max(1, skill // 5):
            success_level = 'Sucesso Extremo'
        elif result <= max(1, skill // 2):
            success_level = 'Sucesso Bom'
        elif result <= skill:
            success_level = 'Sucesso'
        else:
            success_level = 'Falha'

    payload = {
        'char_name': char_name,
        'dice_type': dice_type,
        'result': result,
        'purpose': purpose,
        'skill_value': skill_value,
        'success_level': success_level
    }

    if supabase:
        supabase.table('dice_rolls').insert({
            'character_name': char_name,
            'dice_type': dice_type,
            'result': result,
            'purpose': purpose,
            'is_success': success_level not in [None, 'Falha']
        }).execute()

    socketio.emit('dice_rolled', payload, room='main')

    return jsonify(payload)

# ─────────────────────────────────────────
# MOV DO MONSTRO (FIX IMPORTANTE)
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
# CHAT AO VIVO
# ─────────────────────────────────────────

@app.route('/api/chat/send', methods=['POST'])
def chat_send():
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401

    data = request.get_json()
    message = data.get('message', '').strip()

    if not message:
        return jsonify({'error': 'Mensagem vazia'}), 400

    payload = {
        'username': session.get('username'),
        'message': message,
        'timestamp': datetime.now().strftime('%H:%M')
    }

    socketio.emit('chat_message', payload, room='main')

    return jsonify({'success': True})

# ─────────────────────────────────────────
# SOCKET
# ─────────────────────────────────────────

@socketio.on('token_size_changed')
def token_size_changed(data):
    emit(
        'token_size_changed',
        data,
        room='main',
        include_self=False
    )

@socketio.on('connect')
def connect():
    join_room('main')
    print("👤 usuário conectado")

@socketio.on('disconnect')
def disconnect():
    print("👤 usuário saiu")
    
@socketio.on('map_part_changed')
def on_map_part_changed(data):
    if not session.get('is_master'):
        return

    emit('map_part_changed', data, room='main', include_self=False)
# ─────────────────────────────────────────
# UPLOAD
# ─────────────────────────────────────────

@app.route('/api/upload', methods=['POST'])
def upload():
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401

    if not supabase:
        return jsonify({'error': 'Supabase não conectado'}), 500

    file = request.files.get('file')
    if not file or not allowed_file(file.filename):
        return jsonify({'error': 'Arquivo inválido'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    storage_path = f"uploads/{filename}"

    file_bytes = file.read()

    supabase.storage.from_("rpg_assets").upload(
        path=storage_path,
        file=file_bytes,
        file_options={
            "content-type": file.content_type,
            "upsert": "false"
        }
    )

    public_url = supabase.storage.from_("rpg_assets").get_public_url(storage_path)

    return jsonify({'url': public_url})

# ─────────────────────────────────────────
# MAIN (PROD READY)
# ─────────────────────────────────────────

if __name__ == '__main__':
    os.makedirs('static/uploads', exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, debug=False, host='0.0.0.0', port=port)


    ## teste de envio