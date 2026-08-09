#!/usr/bin/env python3
"""
CSV Data Generator for Anmategra Database Seeding
Uses Faker to generate realistic test data for all database tables defined in schema.ts
"""

import csv
import os
import random
from datetime import datetime, timedelta
import uuid
from faker import Faker

# Configuration
ROWS_COUNT = 100  # Default number of rows - change this easily
OUTPUT_DIR = "data"

# Initialize Faker with Indonesian locale for more realistic data
fake = Faker(['id_ID', 'en_US'])
Faker.seed(12345)  # For reproducible data

def ensure_output_dir():
    """Create output directory if it doesn't exist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

def write_csv(filename: str, data: list, fieldnames: list):
    """Write data to CSV file"""
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
    print(f"✅ Generated {filename} with {len(data)} rows")

def generate_verified_users(count: int = ROWS_COUNT + 20) -> list:
    """Generate verified users data"""
    verified_users = []
    
    for i in range(count):
        verified_user = {
            'id': str(uuid.uuid4()),
            'email': fake.email(),
        }
        verified_users.append(verified_user)
    
    return verified_users

def generate_users(count: int = ROWS_COUNT) -> list:
    """Generate users data using Faker"""
    users = []
    roles = ['admin', 'lembaga', 'mahasiswa']
    
    for i in range(count):
        # Ensure we have at least 2 admins and 20 lembaga users
        if i < 2:
            role = 'admin'
        elif i < 22:
            role = 'lembaga'
        else:
            role = 'mahasiswa'
            
        user = {
            'id': f"user-{i + 1}",
            'name': fake.name(),
            'email': f"user{i + 1}@anmategra.com",  # Keep consistent for testing
            'email_verified': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
            'image': f"https://picsum.photos/200/200?random={i + 1}",
            'role': role,
            'created_at': fake.date_time_between(start_date='-2y', end_date='now').isoformat(),
            'updated_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
        }
        users.append(user)
    
    return users

def generate_mahasiswa(users: list) -> list:
    """Generate mahasiswa profiles for mahasiswa users using Faker"""
    mahasiswa_users = [u for u in users if u['role'] == 'mahasiswa']
    mahasiswa = []
    
    jurusan_options = [
        'Teknik Informatika', 'Sistem Informasi', 'Teknik Komputer', 
        'Teknik Elektro', 'Manajemen', 'Akuntansi', 'Teknik Industri'
    ]
    
    for i, user in enumerate(mahasiswa_users):
        mahasiswa_data = {
            'user_id': user['id'],
            'nim': 20000000 + random.randint(1000, 9999) + (i % 5) * 10000,  # Years 2020-2024
            'jurusan': random.choice(jurusan_options),
            'angkatan': 2020 + (i % 5),
            'line_id': f"line_{user['name'].lower().replace(' ', '_')}",
            'whatsapp': f"+628{fake.numerify('#########')}",  # Indonesian phone format
            'created_at': fake.date_time_between(start_date='-2y', end_date='now').isoformat(),
            'updated_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
        }
        mahasiswa.append(mahasiswa_data)
    
    return mahasiswa

def generate_lembaga(users: list) -> list:
    """Generate lembaga for lembaga users using Faker"""
    lembaga_users = [u for u in users if u['role'] == 'lembaga']
    lembaga = []
    
    lembaga_types = ['Himpunan', 'UKM', 'Kepanitiaan']
    majors = ['Teknik Informatika', 'Sistem Informasi', 'Teknik Komputer', 'Teknik Elektro']
    fields = ['Teknologi', 'Seni', 'Olahraga', 'Sosial', 'Akademik', 'Lingkungan']
    org_names = ['TechFest', 'Coding Club', 'Robotics', 'AI Society', 'Web Dev', 'Mobile Dev', 'Data Science', 'Cyber Security']
    
    for i, user in enumerate(lembaga_users):
        lembaga_type = random.choice(lembaga_types)
        lembaga_data = {
            'id': f"lembaga-{i + 1}",
            'user_id': user['id'],
            'name': f"{random.choice(['Himpunan', 'UKM', 'Organisasi'])} {random.choice(org_names)}",
            'description': fake.text(max_nb_chars=200),  # More realistic descriptions
            'founding_date': fake.date_between(start_date='-8y', end_date='-1y').isoformat(),
            'ending_date': fake.date_between(start_date='now', end_date='+2y').isoformat() if random.random() > 0.8 else '',
            'type': lembaga_type,
            'major': random.choice(majors) if lembaga_type == 'Himpunan' else '',
            'field': random.choice(fields) if lembaga_type == 'UKM' else '',
            'member_count': random.randint(10, 200),
            'created_at': fake.date_time_between(start_date='-2y', end_date='now').isoformat(),
            'updated_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
        }
        lembaga.append(lembaga_data)
    
    return lembaga

def generate_events(lembaga: list, count: int = ROWS_COUNT + 50) -> list:
    """Generate events using Faker"""
    events = []
    
    event_statuses = ['Coming Soon', 'On going', 'Ended']
    event_types = ['TechFest', 'Workshop', 'Seminar', 'Competition', 'Conference', 'Bootcamp', 'Hackathon', 'Exhibition']
    tech_fields = ['AI', 'Web Dev', 'Mobile', 'Data Science', 'Blockchain', 'IoT', 'Cyber Security', 'Cloud Computing']
    
    for i in range(count):
        start_date = fake.date_time_between(start_date='-30d', end_date='+365d')
        end_date = fake.date_time_between(start_date=start_date, end_date=start_date + timedelta(days=random.randint(1, 7)))
        
        event_type = random.choice(event_types)
        event = {
            'id': f"event-{i + 1}",
            'org_id': random.choice(lembaga)['id'] if lembaga else '',
            'name': f"{event_type} {random.choice(tech_fields)} {fake.year()}",
            'description': fake.text(max_nb_chars=300),  # More realistic descriptions
            'image': fake.image_url(width=800, height=600),  # Faker-generated image URLs
            'background_image': fake.image_url(width=1200, height=800),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'status': random.choice(event_statuses),
            'oprec_link': fake.url() if fake.boolean(chance_of_getting_true=50) else '',
            'location': fake.random_element(elements=['Gedung A', 'Gedung B', 'Aula Utama', 'Lab Komputer', 'Ruang Seminar', 'Online (Zoom)', 'Lapangan Kampus', fake.city()]),
            'participant_limit': random.randint(50, 500),
            'participant_count': random.randint(0, 100),
            'is_highlighted': fake.boolean(chance_of_getting_true=20),
            'is_organogram': fake.boolean(chance_of_getting_true=40),
            'created_at': fake.date_time_between(start_date=start_date - timedelta(days=60), end_date=start_date - timedelta(days=1)).isoformat(),
            'updated_at': fake.date_time_between(start_date=start_date - timedelta(days=30), end_date='now').isoformat(),
        }
        events.append(event)
    
    return events

def generate_accounts(users: list, count: int = None) -> list:
    """Generate OAuth accounts for users - one account per user"""
    accounts = []
    
    providers = ['google', 'github', 'microsoft']
    # Generate accounts for ALL users, not just admins
    target_users = users if count is None else users[:count]
    
    for i, user in enumerate(target_users):
        provider = random.choice(providers)
        account = {
            'user_id': user['id'],
            'type': 'oauth',
            'provider': provider,
            'provider_account_id': str(uuid.uuid4()),
            'refresh_token': str(uuid.uuid4()),
            'access_token': str(uuid.uuid4()),
            'expires_at': random.randint(1640995200, 1703980800),  # 2022-2024
            'token_type': 'Bearer',
            'scope': 'read:user user:email',
            'id_token': str(uuid.uuid4()),
            'session_state': str(uuid.uuid4()),
        }
        accounts.append(account)
    
    return accounts

def generate_verification_tokens(count: int = 20) -> list:
    """Generate email verification tokens"""
    tokens = []
    
    for i in range(count):
        token = {
            'identifier': fake.email(),
            'token': str(uuid.uuid4()),
            'expires': fake.date_time_between(start_date='+1h', end_date='+24h').isoformat(),
        }
        tokens.append(token)
    
    return tokens

def generate_profil_km(count: int = 4) -> list:
    """Generate student profile templates with specific descriptions for manual seeding"""
    profil_km = []
    
    # Specific descriptions as requested
    manual_descriptions = [
        "Memiliki kemampuan berpikir tingkat tinggi dan mampu mengimplementasikannya dalam kehidupan sehari-hari.",
        "Memiliki kemampuan sebagai pembelajar seumur hidup",
        "Memiliki kemampuan untuk berkolaborasi secara efektif dalam lingkungan masyarakat akademik maupun masyarakat umum",
        "Memiliki kesadaran akan tanggung jawab sosial serta mampu menerapkan pendekatan multidisiplin dan interdisiplin dalam memecahkan berbagai masalah terkait keprofesian dan masyarakat yang luas."
    ]
    
    for i, description in enumerate(manual_descriptions):
        profil = {
            'id': str(uuid.uuid4()),
            'description': description,
        }
        profil_km.append(profil)
    
    return profil_km

def generate_profil_kegiatan(events: list, count: int = 60) -> list:
    """Generate profil kegiatan based on events"""
    profil_kegiatan = []
    
    # Profile types based on event activities
    profile_names = [
        'Leadership', 'Teamwork', 'Communication', 'Problem Solving', 'Critical Thinking',
        'Creativity', 'Time Management', 'Project Management', 'Technical Skills', 'Presentation Skills'
    ]
    
    for i in range(min(count, len(events) * 2)):  # Multiple profiles per event
        event = random.choice(events)
        profile_name = random.choice(profile_names)
        
        profil = {
            'id': str(uuid.uuid4()),
            'eventId': event['id'],
            'name': f"{profile_name} - {event['name'][:30]}",
            'description': fake.text(max_nb_chars=200),
        }
        profil_kegiatan.append(profil)
    
    return profil_kegiatan

def generate_profil_lembaga(lembaga: list, count: int = 40) -> list:
    """Generate profil lembaga based on lembaga organizations"""
    profil_lembaga = []
    
    # Profile types based on organization activities
    profile_names = [
        'Organizational Management', 'Strategic Planning', 'Community Engagement', 'Academic Excellence',
        'Innovation', 'Social Responsibility', 'Digital Literacy', 'Research Skills', 'Networking', 'Mentorship'
    ]
    
    for i in range(min(count, len(lembaga) * 2)):  # Multiple profiles per lembaga
        org = random.choice(lembaga)
        profile_name = random.choice(profile_names)
        
        profil = {
            'id': str(uuid.uuid4()),
            'lembagaId': org['id'],
            'name': f"{profile_name} - {org['name'][:30]}",
            'description': fake.text(max_nb_chars=200),
        }
        profil_lembaga.append(profil)
    
    return profil_lembaga

def generate_keanggotaan(users: list, events: list, count: int = ROWS_COUNT + 30) -> list:
    """Generate keanggotaan (event membership) relationships between users and events"""
    mahasiswa_users = [u for u in users if u['role'] == 'mahasiswa']
    keanggotaan = []
    
    positions = ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Koordinator', 'Anggota', 'Staff']
    divisions = ['Acara', 'Humas', 'Konsumsi', 'Perlengkapan', 'Dokumentasi', 'Keamanan', 'Transportasi']
    
    for i in range(min(count, len(mahasiswa_users) * 2)):  # Some mahasiswa can be in multiple events
        mahasiswa_user = random.choice(mahasiswa_users)
        selected_event = random.choice(events)
        
        membership = {
            'id': str(uuid.uuid4()),
            'event_id': selected_event['id'],
            'user_id': mahasiswa_user['id'],
            'position': random.choice(positions),
            'division': random.choice(divisions),
            'description': fake.text(max_nb_chars=200) if fake.boolean(chance_of_getting_true=30) else None,
        }
        keanggotaan.append(membership)
    
    return keanggotaan

def generate_kehimpunan(users: list, lembaga: list, count: int = 30) -> list:
    """Generate kehimpunan relationships between users and lembaga"""
    mahasiswa_users = [u for u in users if u['role'] == 'mahasiswa']
    kehimpunan = []
    
    positions = ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Koordinator', 'Anggota']
    divisions = ['Akademik', 'Minat Bakat', 'Pengembangan Diri', 'Humas', 'Internal']
    
    for i in range(count):
        mahasiswa_user = random.choice(mahasiswa_users)
        selected_lembaga = random.choice(lembaga)
        
        kehimpunan_data = {
            'id': str(uuid.uuid4()),
            'userId': mahasiswa_user['id'],
            'lembagaId': selected_lembaga['id'],
            'division': random.choice(divisions),
            'position': random.choice(positions),
        }
        kehimpunan.append(kehimpunan_data)
    
    return kehimpunan

def generate_association_requests(users: list, events: list, count: int = 50) -> list:
    """Generate association requests from users to events"""
    mahasiswa_users = [u for u in users if u['role'] == 'mahasiswa']
    association_requests = []
    
    statuses = ['Pending', 'Accepted', 'Declined']
    positions = ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Koordinator', 'Anggota', 'Staff']
    divisions = ['Acara', 'Humas', 'Konsumsi', 'Perlengkapan', 'Dokumentasi', 'Keamanan', 'Transportasi']
    
    for i in range(count):
        requester = random.choice(mahasiswa_users)
        target_event = random.choice(events)
        
        request = {
            'id': str(uuid.uuid4()),
            'event_id': target_event['id'],
            'user_id': requester['id'],
            'position': random.choice(positions),
            'division': random.choice(divisions),
            'status': random.choice(statuses),
            'created_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
            'updated_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
        }
        association_requests.append(request)
    
    return association_requests

def generate_association_requests_lembaga(users: list, lembaga: list, count: int = 30) -> list:
    """Generate association requests from users to lembaga"""
    mahasiswa_users = [u for u in users if u['role'] == 'mahasiswa']
    association_requests_lembaga = []
    
    statuses = ['Pending', 'Accepted', 'Declined']
    positions = ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Koordinator', 'Anggota']
    divisions = ['Akademik', 'Minat Bakat', 'Pengembangan Diri', 'Humas', 'Internal']
    
    for i in range(count):
        requester = random.choice(mahasiswa_users)
        target_lembaga = random.choice(lembaga)
        
        request = {
            'id': str(uuid.uuid4()),
            'lembagaId': target_lembaga['id'],
            'user_id': requester['id'],
            'position': random.choice(positions),
            'division': random.choice(divisions),
            'status': random.choice(statuses),
            'created_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
            'updated_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
        }
        association_requests_lembaga.append(request)
    
    return association_requests_lembaga

def generate_support(users: list, count: int = 40) -> list:
    """Generate support tickets"""
    support = []
    
    statuses = ['Open', 'In Progress', 'Resolved', 'Closed']
    topics = ['Technical Issue', 'Account Problem', 'Feature Request', 'Bug Report', 'General Inquiry']
    
    for i in range(count):
        user = random.choice(users)
        
        ticket = {
            'id': str(uuid.uuid4()),
            'user_id': user['id'],
            'subject': fake.sentence(nb_words=6),
            'topic': random.choice(topics),
            'description': fake.text(max_nb_chars=500),
            'status': random.choice(statuses),
            'created_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
            'updated_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
        }
        support.append(ticket)
    
    return support

def generate_support_replies(support_tickets: list, users: list, count: int = 80) -> list:
    """Generate replies to support tickets"""
    support_replies = []
    
    for i in range(count):
        ticket = random.choice(support_tickets)
        user = random.choice(users)  # Could be admin or the original requester
        
        reply = {
            'reply_id': str(uuid.uuid4()),
            'user_id': user['id'],
            'support_id': ticket['id'],
            'text': fake.text(max_nb_chars=300),
            'created_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
            'updated_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
        }
        support_replies.append(reply)
    
    return support_replies

def generate_notifications(users: list, count: int = ROWS_COUNT + 50) -> list:
    """Generate notifications for users"""
    notifications = []
    
    types = ['Association Request', 'System']
    
    for i in range(count):
        user = random.choice(users)
        
        notification = {
            'id': str(uuid.uuid4()),
            'user_id': user['id'],
            'title': fake.sentence(nb_words=5),
            'content': fake.text(max_nb_chars=200),
            'type': random.choice(types),
            'read': random.choice([True, False]),
            'created_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
            'updated_at': fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
        }
        notifications.append(notification)
    
    return notifications

def generate_best_staff_kegiatan(users: list, events: list, count: int = 40) -> list:
    """Generate best staff awards for events"""
    mahasiswa_users = [u for u in users if u['role'] == 'mahasiswa']
    best_staff_kegiatan = []
    
    divisions = ['Acara', 'Humas', 'Konsumsi', 'Perlengkapan', 'Dokumentasi', 'Keamanan', 'Transportasi']
    
    for i in range(count):
        staff = random.choice(mahasiswa_users)
        event = random.choice(events)
        
        # Generate realistic date range during the event period
        event_start = fake.date_time_between_dates(
            datetime_start=datetime.fromisoformat(event['start_date'].replace('Z', '+00:00')), 
            datetime_end=datetime.fromisoformat(event['end_date'].replace('Z', '+00:00')) if event['end_date'] else datetime.fromisoformat(event['start_date'].replace('Z', '+00:00')) + timedelta(days=7)
        )
        event_end = fake.date_time_between_dates(
            datetime_start=event_start,
            datetime_end=event_start + timedelta(days=random.randint(1, 30))
        )
        
        award = {
            'id': str(uuid.uuid4()),
            'eventId': event['id'],
            'mahasiswaId': staff['id'],  # Use user_id for mahasiswa reference
            'division': random.choice(divisions),
            'startDate': event_start.isoformat(),
            'endDate': event_end.isoformat(),
        }
        best_staff_kegiatan.append(award)
    
    return best_staff_kegiatan

def generate_best_staff_lembaga(users: list, lembaga: list, count: int = 30) -> list:
    """Generate best staff awards for lembaga"""
    mahasiswa_users = [u for u in users if u['role'] == 'mahasiswa']
    best_staff_lembaga = []
    
    divisions = ['Akademik', 'Minat Bakat', 'Pengembangan Diri', 'Humas', 'Internal']
    
    for i in range(count):
        staff = random.choice(mahasiswa_users)
        org = random.choice(lembaga)
        
        # Generate realistic date range 
        start_date = fake.date_time_between(start_date='-1y', end_date='now')
        end_date = fake.date_time_between_dates(
            datetime_start=start_date,
            datetime_end=start_date + timedelta(days=random.randint(30, 365))
        )
        
        award = {
            'id': str(uuid.uuid4()),
            'lembagaId': org['id'],
            'mahasiswaId': staff['id'],  # Use user_id for mahasiswa reference
            'division': random.choice(divisions),
            'startDate': start_date.isoformat(),
            'endDate': end_date.isoformat(),
        }
        best_staff_lembaga.append(award)
    
    return best_staff_lembaga

def generate_pemetaan_profil_kegiatan(profil_kegiatan: list, profil_km: list, count: int = 50) -> list:
    """Generate unique mappings between profil kegiatan and profil KM"""
    pemetaan = []
    used_combinations = set()  # Track used (profil_kegiatan_id, profil_km_id) combinations
    
    # Ensure we don't try to generate more combinations than possible
    max_possible = len(profil_kegiatan) * len(profil_km)
    actual_count = min(count, max_possible)
    
    attempts = 0
    max_attempts = actual_count * 3  # Allow some retries
    
    while len(pemetaan) < actual_count and attempts < max_attempts:
        profil_keg = random.choice(profil_kegiatan)
        profil_km_item = random.choice(profil_km)
        combination = (profil_keg['id'], profil_km_item['id'])
        
        if combination not in used_combinations:
            used_combinations.add(combination)
            mapping = {
                'id': str(uuid.uuid4()),
                'profil_kegiatan_id': profil_keg['id'],
                'profil_km_id': profil_km_item['id'],
            }
            pemetaan.append(mapping)
        
        attempts += 1
    
    return pemetaan

def generate_pemetaan_profil_lembaga(profil_lembaga: list, profil_km: list, count: int = 40) -> list:
    """Generate unique mappings between profil lembaga and profil KM"""
    pemetaan = []
    used_combinations = set()  # Track used (profil_lembaga_id, profil_km_id) combinations
    
    # Ensure we don't try to generate more combinations than possible
    max_possible = len(profil_lembaga) * len(profil_km)
    actual_count = min(count, max_possible)
    
    attempts = 0
    max_attempts = actual_count * 3  # Allow some retries
    
    while len(pemetaan) < actual_count and attempts < max_attempts:
        profil_lem = random.choice(profil_lembaga)
        profil_km_item = random.choice(profil_km)
        combination = (profil_lem['id'], profil_km_item['id'])
        
        if combination not in used_combinations:
            used_combinations.add(combination)
            mapping = {
                'id': str(uuid.uuid4()),
                'profil_lembaga_id': profil_lem['id'],
                'profil_km_id': profil_km_item['id'],
            }
            pemetaan.append(mapping)
        
        attempts += 1
    
    return pemetaan

def generate_nilai_profil_kegiatan(profil_kegiatan: list, users: list, count: int = 80) -> list:
    """Generate nilai (scores) for profil kegiatan with unique profil_id, mahasiswa_id combinations"""
    mahasiswa_users = [u for u in users if u['role'] == 'mahasiswa']
    nilai = []
    used_combinations = set()  # Track used (profil_id, mahasiswa_id) combinations
    
    # Ensure we don't try to generate more combinations than possible
    max_possible = len(profil_kegiatan) * len(mahasiswa_users)
    actual_count = min(count, max_possible)
    
    attempts = 0
    max_attempts = actual_count * 3  # Allow some retries
    
    while len(nilai) < actual_count and attempts < max_attempts:
        profil = random.choice(profil_kegiatan)
        mahasiswa = random.choice(mahasiswa_users)
        combination = (profil['id'], mahasiswa['id'])
        
        if combination not in used_combinations:
            used_combinations.add(combination)
            score = {
                'id': str(uuid.uuid4()),
                'profil_id': profil['id'],
                'mahasiswa_id': mahasiswa['id'],
                'nilai': random.randint(60, 100),  # Score between 60-100
            }
            nilai.append(score)
        
        attempts += 1
    
    return nilai

def generate_nilai_profil_lembaga(profil_lembaga: list, users: list, count: int = 70) -> list:
    """Generate nilai (scores) for profil lembaga with unique profil_id, mahasiswa_id combinations"""
    mahasiswa_users = [u for u in users if u['role'] == 'mahasiswa']
    nilai = []
    used_combinations = set()  # Track used (profil_id, mahasiswa_id) combinations
    
    # Ensure we don't try to generate more combinations than possible
    max_possible = len(profil_lembaga) * len(mahasiswa_users)
    actual_count = min(count, max_possible)
    
    attempts = 0
    max_attempts = actual_count * 3  # Allow some retries
    
    while len(nilai) < actual_count and attempts < max_attempts:
        profil = random.choice(profil_lembaga)
        mahasiswa = random.choice(mahasiswa_users)
        combination = (profil['id'], mahasiswa['id'])
        
        if combination not in used_combinations:
            used_combinations.add(combination)
            score = {
                'id': str(uuid.uuid4()),
                'profil_id': profil['id'],
                'mahasiswa_id': mahasiswa['id'],
                'nilai': random.randint(60, 100),  # Score between 60-100
            }
            nilai.append(score)
        
        attempts += 1
    
    return nilai

def main():
    """Main function to generate complete CSV files for all tables"""
    print(f"🌱 Generating complete CSV files with {ROWS_COUNT} base rows...")
    ensure_output_dir()
    
    # Step 1: Generate base independent data
    print("📧 Generating verified users...")
    verified_users = generate_verified_users()
    write_csv('verified_users.csv', verified_users, ['id', 'email'])
    
    print("📊 Generating users...")
    users = generate_users()
    write_csv('users.csv', users, [
        'id', 'name', 'email', 'email_verified', 'image', 'role', 'created_at', 'updated_at'
    ])
    
    print("🎓 Generating mahasiswa...")
    mahasiswa = generate_mahasiswa(users)
    write_csv('mahasiswa.csv', mahasiswa, [
        'user_id', 'nim', 'jurusan', 'angkatan', 'line_id', 'whatsapp', 'created_at', 'updated_at'
    ])
    
    print("🏢 Generating lembaga...")
    lembaga = generate_lembaga(users)
    write_csv('lembaga.csv', lembaga, [
        'id', 'user_id', 'name', 'description', 'founding_date', 'ending_date', 
        'type', 'major', 'field', 'member_count', 'created_at', 'updated_at'
    ])
    
    print("📅 Generating events...")
    events = generate_events(lembaga)
    write_csv('events.csv', events, [
        'id', 'org_id', 'name', 'description', 'image', 'background_image',
        'start_date', 'end_date', 'status', 'oprec_link', 'location',
        'participant_limit', 'participant_count', 'is_highlighted', 'is_organogram',
        'created_at', 'updated_at'
    ])
    
    # Step 2: Generate auth-related data (no sessions as requested)
    print("🔐 Generating accounts (one per user)...")
    accounts = generate_accounts(users)  # Generate for ALL users
    write_csv('accounts.csv', accounts, [
        'user_id', 'type', 'provider', 'provider_account_id', 'refresh_token',
        'access_token', 'expires_at', 'token_type', 'scope', 'id_token', 'session_state'
    ])
    
    print("🎫 Generating verification tokens...")
    verification_tokens = generate_verification_tokens(20)
    write_csv('verification_tokens.csv', verification_tokens, [
        'identifier', 'token', 'expires'
    ])
    
    # Step 3: Generate relationship and activity data
    print("👤 Generating keanggotaan...")
    keanggotaan = generate_keanggotaan(users, events)
    write_csv('keanggotaan.csv', keanggotaan, [
        'id', 'event_id', 'user_id', 'position', 'division', 'description'
    ])
    
    print("🤝 Generating kehimpunan...")
    kehimpunan = generate_kehimpunan(users, lembaga)
    write_csv('kehimpunan.csv', kehimpunan, [
        'id', 'userId', 'lembagaId', 'division', 'position'
    ])
    
    print("📝 Generating association requests...")
    association_requests = generate_association_requests(users, events)
    write_csv('association_requests.csv', association_requests, [
        'id', 'event_id', 'user_id', 'position', 'division', 'status', 'created_at', 'updated_at'
    ])
    
    print("📋 Generating lembaga association requests...")
    association_requests_lembaga = generate_association_requests_lembaga(users, lembaga)
    write_csv('association_requests_lembaga.csv', association_requests_lembaga, [
        'id', 'lembagaId', 'user_id', 'position', 'division', 'status', 'created_at', 'updated_at'
    ])
    
    print("⭐ Generating best staff kegiatan...")
    best_staff_kegiatan = generate_best_staff_kegiatan(users, events)
    write_csv('best_staff_kegiatan.csv', best_staff_kegiatan, [
        'id', 'eventId', 'mahasiswaId', 'division', 'startDate', 'endDate'
    ])
    
    print("🌟 Generating best staff lembaga...")
    best_staff_lembaga = generate_best_staff_lembaga(users, lembaga)
    write_csv('best_staff_lembaga.csv', best_staff_lembaga, [
        'id', 'lembagaId', 'mahasiswaId', 'division', 'startDate', 'endDate'
    ])
    
    print("🎫 Generating support tickets...")
    support = generate_support(users)
    write_csv('support.csv', support, [
        'id', 'user_id', 'subject', 'topic', 'description', 'status', 'created_at', 'updated_at'
    ])
    
    print("💬 Generating support replies...")
    support_replies = generate_support_replies(support, users)
    write_csv('support_replies.csv', support_replies, [
        'reply_id', 'user_id', 'support_id', 'text', 'created_at', 'updated_at'
    ])
    
    print("🔔 Generating notifications...")
    notifications = generate_notifications(users)
    write_csv('notifications.csv', notifications, [
        'id', 'user_id', 'title', 'content', 'type', 'read', 'created_at', 'updated_at'
    ])
    
    # Step 4: Generate profile data with CSV output
    print("🎯 Generating profil kegiatan...")
    profil_kegiatan = generate_profil_kegiatan(events)
    write_csv('profil_kegiatan.csv', profil_kegiatan, [
        'id', 'eventId', 'name', 'description'
    ])
    
    print("🏛️ Generating profil lembaga...")
    profil_lembaga = generate_profil_lembaga(lembaga)
    write_csv('profil_lembaga.csv', profil_lembaga, [
        'id', 'lembagaId', 'name', 'description'
    ])
    
    # Step 5: Generate profil_km with predetermined values and CSV output
    print("👥 Generating profil KM with predetermined descriptions...")
    profil_km = generate_profil_km(4)
    write_csv('profil_km.csv', profil_km, ['id', 'description'])
    
    # Step 6: Generate profile mappings and scores
    print("🗺️ Generating pemetaan profil kegiatan...")
    pemetaan_profil_kegiatan = generate_pemetaan_profil_kegiatan(profil_kegiatan, profil_km)
    write_csv('pemetaan_profil_kegiatan.csv', pemetaan_profil_kegiatan, [
        'id', 'profil_kegiatan_id', 'profil_km_id'
    ])
    
    print("🗂️ Generating pemetaan profil lembaga...")
    pemetaan_profil_lembaga = generate_pemetaan_profil_lembaga(profil_lembaga, profil_km)
    write_csv('pemetaan_profil_lembaga.csv', pemetaan_profil_lembaga, [
        'id', 'profil_lembaga_id', 'profil_km_id'
    ])
    
    print("📊 Generating nilai profil kegiatan...")
    nilai_profil_kegiatan = generate_nilai_profil_kegiatan(profil_kegiatan, users)
    write_csv('nilai_profil_kegiatan.csv', nilai_profil_kegiatan, [
        'id', 'profil_id', 'mahasiswa_id', 'nilai'
    ])
    
    print("📈 Generating nilai profil lembaga...")
    nilai_profil_lembaga = generate_nilai_profil_lembaga(profil_lembaga, users)
    write_csv('nilai_profil_lembaga.csv', nilai_profil_lembaga, [
        'id', 'profil_id', 'mahasiswa_id', 'nilai'
    ])
    
    print("🎉 Complete CSV generation finished!")
    print(f"📁 All files saved to: {OUTPUT_DIR}")
    print(f"📊 Generated data summary:")
    print(f"   - {len(verified_users)} verified users")
    print(f"   - {len(users)} users")
    print(f"   - {len(mahasiswa)} mahasiswa profiles")
    print(f"   - {len(lembaga)} lembaga")
    print(f"   - {len(events)} events")
    print(f"   - {len(accounts)} accounts (one per user)")
    print(f"   - {len(verification_tokens)} verification tokens")
    print(f"   - {len(keanggotaan)} keanggotaan memberships")
    print(f"   - {len(kehimpunan)} kehimpunan relationships")
    print(f"   - {len(association_requests)} association requests")
    print(f"   - {len(association_requests_lembaga)} lembaga association requests")
    print(f"   - {len(best_staff_kegiatan)} best staff kegiatan awards")
    print(f"   - {len(best_staff_lembaga)} best staff lembaga awards")
    print(f"   - {len(support)} support tickets")
    print(f"   - {len(support_replies)} support replies")
    print(f"   - {len(notifications)} notifications")
    print(f"   - {len(profil_kegiatan)} profil kegiatan")
    print(f"   - {len(profil_lembaga)} profil lembaga")
    print(f"   - {len(profil_km)} profil KM (with predetermined descriptions)")
    print(f"   - {len(pemetaan_profil_kegiatan)} pemetaan profil kegiatan")
    print(f"   - {len(pemetaan_profil_lembaga)} pemetaan profil lembaga")
    print(f"   - {len(nilai_profil_kegiatan)} nilai profil kegiatan")
    print(f"   - {len(nilai_profil_lembaga)} nilai profil lembaga")
    print(f"\n✅ All CSV files generated successfully!")

if __name__ == "__main__":
    main()