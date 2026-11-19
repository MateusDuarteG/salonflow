import os
from datetime import datetime, timedelta, timezone
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, request, session, redirect, url_for, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import and_, or_
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-only-change-this-secret")
database_url = os.getenv("DATABASE_URL", "sqlite:///salonflow.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("COOKIE_SECURE", "false").lower() == "true"

db = SQLAlchemy(app)


class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(140), nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)


class Unit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("company.id"), nullable=False, index=True)
    name = db.Column(db.String(140), nullable=False)
    slug = db.Column(db.String(120), unique=True, nullable=False)
    city = db.Column(db.String(100), default="")
    active = db.Column(db.Boolean, default=True, nullable=False)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("company.id"), nullable=False, index=True)
    unit_id = db.Column(db.Integer, db.ForeignKey("unit.id"), nullable=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), default="manager", nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)


class Client(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("company.id"), nullable=False, index=True)
    name = db.Column(db.String(140), nullable=False)
    phone = db.Column(db.String(40), nullable=False)
    email = db.Column(db.String(180), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Professional(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("company.id"), nullable=False, index=True)
    unit_id = db.Column(db.Integer, db.ForeignKey("unit.id"), nullable=False, index=True)
    name = db.Column(db.String(140), nullable=False)
    specialty = db.Column(db.String(140), default="")
    active = db.Column(db.Boolean, default=True, nullable=False)


class Service(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("company.id"), nullable=False, index=True)
    unit_id = db.Column(db.Integer, db.ForeignKey("unit.id"), nullable=False, index=True)
    name = db.Column(db.String(140), nullable=False)
    duration_minutes = db.Column(db.Integer, nullable=False, default=60)
    price_cents = db.Column(db.Integer, nullable=False, default=0)
    active = db.Column(db.Boolean, default=True, nullable=False)


class Appointment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("company.id"), nullable=False, index=True)
    unit_id = db.Column(db.Integer, db.ForeignKey("unit.id"), nullable=False, index=True)
    client_id = db.Column(db.Integer, db.ForeignKey("client.id"), nullable=False, index=True)
    professional_id = db.Column(db.Integer, db.ForeignKey("professional.id"), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey("service.id"), nullable=False)
    start_at = db.Column(db.DateTime, nullable=False, index=True)
    end_at = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(30), nullable=False, default="pending", index=True)
    notes = db.Column(db.String(500), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    client = db.relationship("Client")
    professional = db.relationship("Professional")
    service = db.relationship("Service")


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return db.session.get(User, user_id)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user or not user.active:
            return jsonify({"error": "Autenticação necessária."}), 401
        return fn(*args, **kwargs)
    return wrapper


def scoped_query(model):
    """Toda consulta administrativa é limitada à empresa da sessão."""
    user = current_user()
    return model.query.filter_by(company_id=user.company_id)


def parse_local_datetime(value):
    # O MVP recebe data/hora local da unidade. Timezone será configurável por unidade.
    return datetime.fromisoformat(value)


def appointment_dict(a):
    return {
        "id": a.id,
        "client": a.client.name,
        "phone": a.client.phone,
        "service": a.service.name,
        "professional": a.professional.name,
        "start_at": a.start_at.isoformat(timespec="minutes"),
        "end_at": a.end_at.isoformat(timespec="minutes"),
        "status": a.status,
        "price": a.service.price_cents / 100,
    }


def has_conflict(professional_id, start_at, end_at, ignore_id=None):
    q = Appointment.query.filter(
        Appointment.professional_id == professional_id,
        Appointment.status != "cancelled",
        Appointment.start_at < end_at,
        Appointment.end_at > start_at,
    )
    if ignore_id:
        q = q.filter(Appointment.id != ignore_id)
    return q.first() is not None


@app.get("/")
def home():
    if not current_user():
        return redirect(url_for("login_page"))
    return render_template("index.html")


@app.get("/login")
def login_page():
    if current_user():
        return redirect(url_for("home"))
    return render_template("login.html")


@app.get("/agendar")
def public_booking_page():
    return render_template("cliente.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "SalonFlow API"})


@app.post("/api/login")
def api_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email, active=True).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "E-mail ou senha inválidos."}), 401
    session.clear()
    session["user_id"] = user.id
    return jsonify({"id": user.id, "name": user.name, "email": user.email, "role": user.role})


@app.post("/api/logout")
@login_required
def api_logout():
    session.clear()
    return jsonify({"ok": True})

@app.get("/register")
def register_page():
    if current_user():
        return redirect(url_for("home"))
    return render_template("register.html")


@app.post("/api/register")
def api_register():
    data = request.get_json(silent=True) or {}
    company_name = (data.get("company_name") or "").strip()
    company_slug = (data.get("company_slug") or "").strip().lower()
    unit_name = (data.get("unit_name") or "Unidade Matriz").strip()
    unit_slug = (data.get("unit_slug") or "").strip().lower()
    user_name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not company_name or not company_slug or not user_name or not email or not password:
        return jsonify({"error": "Preencha todos os campos obrigatórios."}), 400

    if Company.query.filter_by(slug=company_slug).first():
        return jsonify({"error": "Este identificador (slug) de empresa já está em uso."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Este e-mail já está cadastrado no sistema."}), 400

    try:
        # 1. Cria a nova Empresa
        company = Company(name=company_name, slug=company_slug, active=True)
        db.session.add(company)
        db.session.flush()

        # 2. Cria automaticamente a primeira Unidade (Matriz)
        unit = Unit(
            company_id=company.id,
            name=unit_name,
            slug=unit_slug or f"{company_slug}-matriz",
            city=data.get("city", "")
        )
        db.session.add(unit)
        db.session.flush()

        # 3. Cria o usuário proprietário/gerente (Owner) já amarrado na unit_id!
        user = User(
            company_id=company.id,
            unit_id=unit.id, # <--- BLINDAGEM: Garante que o usuário pertence à matriz
            name=user_name,
            email=email,
            password_hash=generate_password_hash(password),
            role="manager",
            active=True
        )
        db.session.add(user)

        db.session.commit()

        session.clear()
        session["user_id"] = user.id

        return jsonify({"success": True, "message": "Empresa cadastrada com sucesso!"}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Erro interno ao registrar: {str(e)}"}), 500

@app.get("/api/me")
@login_required
def api_me():
    user = current_user()
    return jsonify({"id": user.id, "name": user.name, "email": user.email, "role": user.role})


@app.get("/api/dashboard")
@login_required
def api_dashboard():
    user = current_user()
    today = datetime.now().date()
    start = datetime.combine(today, datetime.min.time())
    end = start + timedelta(days=1)
    q = scoped_query(Appointment).filter(Appointment.start_at >= start, Appointment.start_at < end)
    appointments = q.order_by(Appointment.start_at.asc()).all()
    active_count = sum(1 for a in appointments if a.status == "in_progress")
    pending_count = sum(1 for a in appointments if a.status in ("pending", "requested"))
    revenue = sum(a.service.price_cents for a in appointments if a.status == "completed") / 100
    return jsonify({
        "appointments_today": len([a for a in appointments if a.status != "cancelled"]),
        "in_progress": active_count,
        "pending": pending_count,
        "revenue_completed": revenue,
        "appointments": [appointment_dict(a) for a in appointments],
        "company": Company.query.get(user.company_id).name,
        "unit": Unit.query.get(user.unit_id).name if user.unit_id else "Todas as unidades",
    })

@app.get("/api/professionals")
@login_required
def api_professionals():
    q = scoped_query(Professional).filter_by(active=True)
    unit_id = request.args.get("unit_id", type=int)
    if unit_id:
        q = q.filter_by(unit_id=unit_id)
    pros = q.all()
    return jsonify([{
        "id": p.id,
        "name": p.name,
        "specialty": p.specialty,
        "active": p.active
    } for p in pros])

@app.get("/api/appointments")
@login_required
def api_appointments():
    q = scoped_query(Appointment)
    unit_id = request.args.get("unit_id", type=int)
    if unit_id:
        q = q.filter_by(unit_id=unit_id)
    date_value = request.args.get("date")
    if date_value:
        day = datetime.fromisoformat(date_value).date()
        start = datetime.combine(day, datetime.min.time())
        q = q.filter(Appointment.start_at >= start, Appointment.start_at < start + timedelta(days=1))
    return jsonify([appointment_dict(a) for a in q.order_by(Appointment.start_at.asc()).all()])


@app.post("/api/appointments")
@login_required
def api_create_appointment():
    user = current_user()
    data = request.get_json(silent=True) or {}
    required = ["client_name", "phone", "service_id", "professional_id", "start_at"]
    if any(not data.get(k) for k in required):
        return jsonify({"error": "Preencha cliente, telefone, serviço, profissional e horário."}), 400
    
    service = scoped_query(Service).filter_by(id=data["service_id"], active=True).first()
    professional = scoped_query(Professional).filter_by(id=data["professional_id"], active=True).first()
    if not service or not professional:
        return jsonify({"error": "Serviço ou profissional não encontrado nesta empresa."}), 404
        
    # Pega a unidade correta com segurança
    unit_id = data.get("unit_id") or user.unit_id or service.unit_id
    
    start_at = parse_local_datetime(data["start_at"])
    end_at = start_at + timedelta(minutes=service.duration_minutes)
    if has_conflict(professional.id, start_at, end_at):
        return jsonify({"error": "Este profissional já possui um atendimento nesse intervalo."}), 409
        
    client = Client.query.filter_by(company_id=user.company_id, phone=data["phone"]).first()
    if not client:
        client = Client(company_id=user.company_id, name=data["client_name"], phone=data["phone"])
        db.session.add(client)
        db.session.flush()
        
    appointment = Appointment(
        company_id=user.company_id, 
        unit_id=unit_id, 
        client_id=client.id,
        professional_id=professional.id, 
        service_id=service.id,
        start_at=start_at, 
        end_at=end_at, 
        status="confirmed",
        notes=data.get("notes", "")
    )
    db.session.add(appointment)
    db.session.commit()
    return jsonify(appointment_dict(appointment)), 201

@app.patch("/api/appointments/<int:appointment_id>")
@login_required
def api_update_appointment(appointment_id):
    appointment = scoped_query(Appointment).filter_by(id=appointment_id).first()
    if not appointment:
        return jsonify({"error": "Agendamento não encontrado."}), 404
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    allowed = {"requested", "pending", "confirmed", "arrived", "in_progress", "waiting", "completed", "cancelled"}
    if new_status:
        if new_status not in allowed:
            return jsonify({"error": "Status inválido."}), 400
        appointment.status = new_status
    if data.get("start_at"):
        start_at = parse_local_datetime(data["start_at"])
        end_at = start_at + timedelta(minutes=appointment.service.duration_minutes)
        if has_conflict(appointment.professional_id, start_at, end_at, ignore_id=appointment.id):
            return jsonify({"error": "O novo horário conflita com outro atendimento."}), 409
        appointment.start_at, appointment.end_at = start_at, end_at
    db.session.commit()
    return jsonify(appointment_dict(appointment))

@app.get("/api/services")
@login_required
def api_get_services():
    return jsonify([{
        "id": s.id,
        "name": s.name,
        "duration_minutes": s.duration_minutes,
        "price": s.price_cents / 100
    } for s in scoped_query(Service).filter_by(active=True).all()])

@app.post("/api/services")
@login_required
def api_create_service():
    user = current_user()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    duration = int(data.get("duration_minutes", 60))
    price = int(float(data.get("price", 0)) * 100)
    if not name:
        return jsonify({"error": "Nome do serviço é obrigatório."}), 400
    service = Service(company_id=user.company_id, unit_id=user.unit_id, name=name, duration_minutes=duration, price_cents=price, active=True)
    db.session.add(service)
    db.session.commit()
    return jsonify({"id": service.id, "name": service.name}), 201

@app.get("/api/clients")
@login_required
def api_get_clients():
    return jsonify([{
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "email": c.email
    } for c in scoped_query(Client).order_by(Client.name.asc()).all()])

@app.post("/api/clients")
@login_required
def api_create_client():
    user = current_user()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    email = (data.get("email") or "").strip().lower()
    
    if not name or not phone:
        return jsonify({"error": "Nome e telefone são obrigatórios para contato."}), 400
        
    # Verifica se o cliente já existe para esta empresa
    existing = Client.query.filter_by(company_id=user.company_id, phone=phone).first()
    if existing:
        return jsonify({"error": "Já existe um cliente cadastrado com este telefone."}), 400
        
    client = Client(company_id=user.company_id, name=name, phone=phone, email=email)
    db.session.add(client)
    db.session.commit()
    return jsonify({"id": client.id, "name": client.name, "phone": client.phone}), 201

@app.get("/api/admin/catalog")
@login_required
def api_admin_catalog():
    user = current_user()
    services = Service.query.filter_by(company_id=user.company_id, active=True).all()
    professionals = Professional.query.filter_by(company_id=user.company_id, active=True).all()
    return jsonify({
        "services": [{"id": s.id, "name": s.name, "duration_minutes": s.duration_minutes, "price": s.price_cents / 100} for s in services],
        "professionals": [{"id": p.id, "name": p.name, "specialty": p.specialty} for p in professionals]
    })

@app.post("/api/professionals")
@login_required
def api_create_professional():
    user = current_user()
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    specialty = (data.get("specialty") or "").strip()
    if not name:
        return jsonify({"error": "Nome do profissional é obrigatório."}), 400
    prof = Professional(company_id=user.company_id, unit_id=user.unit_id, name=name, specialty=specialty, active=True)
    db.session.add(prof)
    db.session.commit()
    return jsonify({"id": prof.id, "name": prof.name}), 201

@app.get("/api/public/catalog")
def api_public_catalog():
    unit_slug = request.args.get("unit", "studio-lumiere-centro")
    unit = Unit.query.filter_by(slug=unit_slug, active=True).first()
    if not unit:
        return jsonify({"error": "Unidade não encontrada."}), 404
    services = Service.query.filter_by(company_id=unit.company_id, unit_id=unit.id, active=True).all()
    professionals = Professional.query.filter_by(company_id=unit.company_id, unit_id=unit.id, active=True).all()
    return jsonify({
        "unit": {"name": unit.name, "slug": unit.slug},
        "services": [{"id": s.id, "name": s.name, "duration_minutes": s.duration_minutes,
                      "price": s.price_cents / 100} for s in services],
        "professionals": [{"id": p.id, "name": p.name, "specialty": p.specialty} for p in professionals],
    })


@app.post("/api/public/bookings")
def api_public_booking():
    data = request.get_json(silent=True) or {}
    required = ["unit_slug", "client_name", "phone", "service_id", "start_at"]
    if any(not data.get(k) for k in required):
        return jsonify({"error": "Preencha os dados obrigatórios do agendamento."}), 400
    unit = Unit.query.filter_by(slug=data["unit_slug"], active=True).first()
    if not unit:
        return jsonify({"error": "Unidade não encontrada."}), 404
    service = Service.query.filter_by(id=data["service_id"], company_id=unit.company_id,
                                     unit_id=unit.id, active=True).first()
    if not service:
        return jsonify({"error": "Serviço indisponível nesta unidade."}), 404
    professional_id = data.get("professional_id")
    if professional_id:
        professional = Professional.query.filter_by(id=professional_id, company_id=unit.company_id,
                                                     unit_id=unit.id, active=True).first()
    else:
        professional = Professional.query.filter_by(company_id=unit.company_id, unit_id=unit.id,
                                                     active=True).first()
    if not professional:
        return jsonify({"error": "Não há profissional disponível para este serviço."}), 409
    start_at = parse_local_datetime(data["start_at"])
    end_at = start_at + timedelta(minutes=service.duration_minutes)
    if has_conflict(professional.id, start_at, end_at):
        return jsonify({"error": "Este horário acabou de ficar indisponível. Escolha outro."}), 409
    client = Client.query.filter_by(company_id=unit.company_id, phone=data["phone"]).first()
    if not client:
        client = Client(company_id=unit.company_id, name=data["client_name"], phone=data["phone"])
        db.session.add(client)
        db.session.flush()
    appointment = Appointment(company_id=unit.company_id, unit_id=unit.id, client_id=client.id,
                              professional_id=professional.id, service_id=service.id,
                              start_at=start_at, end_at=end_at, status="requested")
    db.session.add(appointment)
    db.session.commit()
    return jsonify({
        "message": "Solicitação de agendamento recebida.",
        "appointment": appointment_dict(appointment),
        "confirmation_status": "requested"
    }), 201


def seed_demo():
    if Company.query.filter_by(slug="studio-lumiere").first():
        return
    company = Company(name="Studio Lumière", slug="studio-lumiere")
    db.session.add(company)
    db.session.flush()
    unit = Unit(company_id=company.id, name="Unidade Centro", slug="studio-lumiere-centro", city="Uberlândia")
    db.session.add(unit)
    db.session.flush()
    admin = User(company_id=company.id, unit_id=unit.id, name="Mariana Costa",
                 email="admin@salonflow.test",
                 password_hash=generate_password_hash("SalonFlow@2026"), role="manager")
    db.session.add(admin)
    pros = [
        Professional(company_id=company.id, unit_id=unit.id, name="Camila Rocha", specialty="Especialista em cor"),
        Professional(company_id=company.id, unit_id=unit.id, name="Pedro Alves", specialty="Barbeiro"),
        Professional(company_id=company.id, unit_id=unit.id, name="Júlia Mendes", specialty="Cabeleireira"),
        Professional(company_id=company.id, unit_id=unit.id, name="Lucas Freitas", specialty="Assistente"),
    ]
    db.session.add_all(pros)
    services = [
        Service(company_id=company.id, unit_id=unit.id, name="Corte feminino", duration_minutes=45, price_cents=9500),
        Service(company_id=company.id, unit_id=unit.id, name="Escova", duration_minutes=40, price_cents=7500),
        Service(company_id=company.id, unit_id=unit.id, name="Coloração", duration_minutes=120, price_cents=28000),
        Service(company_id=company.id, unit_id=unit.id, name="Hidratação", duration_minutes=50, price_cents=13000),
        Service(company_id=company.id, unit_id=unit.id, name="Barba + cabelo", duration_minutes=60, price_cents=11000),
    ]
    db.session.add_all(services)
    db.session.flush()
    sample_clients = [
        ("Ana Ferreira", "34999990001"), ("João Lima", "34999990002"),
        ("Beatriz Martins", "34999990003"), ("Carolina Ribeiro", "34999990004"),
        ("Fernanda Costa", "34999990005"), ("Rafael Moreira", "34999990006"),
    ]
    clients = []
    for name, phone in sample_clients:
        c = Client(company_id=company.id, name=name, phone=phone)
        db.session.add(c)
        clients.append(c)
    db.session.flush()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    sample = [
        (0, 0, 0, 9, 30, "in_progress"),
        (1, 4, 1, 10, 0, "confirmed"),
        (2, 2, 0, 10, 30, "pending"),
        (3, 1, 2, 11, 0, "confirmed"),
        (4, 3, 2, 8, 30, "completed"),
    ]
    for client_idx, service_idx, pro_idx, hour, minute, status in sample:
        start = today.replace(hour=hour, minute=minute)
        service = services[service_idx]
        db.session.add(Appointment(company_id=company.id, unit_id=unit.id,
            client_id=clients[client_idx].id, professional_id=pros[pro_idx].id,
            service_id=service.id, start_at=start,
            end_at=start + timedelta(minutes=service.duration_minutes), status=status))
    db.session.commit()


with app.app_context():
    db.create_all()
    #seed_demo()


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true", port=int(os.getenv("PORT", 5000)))
