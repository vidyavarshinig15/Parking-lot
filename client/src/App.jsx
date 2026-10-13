import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, Bike, CalendarDays,
  CarFront, Check, ChevronRight, Clock3, Download, LogOut, Mail, MapPin,
  ParkingSquare, Phone, Printer, RefreshCw, Search, ShieldCheck,
  TicketCheck, Truck, UserRound,
} from 'lucide-react';
import './app.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TYPES = ['BIKE', 'CAR', 'TRUCK'];
const CAPACITY = { BIKE: 5, CAR: 5, TRUCK: 2 };
const emptyData = { availability: { BIKE: 0, CAR: 0, TRUCK: 0 }, tickets: [], history: [] };
const vehicleIcons = { BIKE: Bike, CAR: CarFront, TRUCK: Truck };

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || 'Unable to complete request');
  return payload;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
}

function vehicleMeta() {
  return JSON.parse(localStorage.getItem('bellcorp_vehicle_meta') || '{}');
}

function saveVehicleMeta(ticket, values) {
  const all = vehicleMeta();
  all[ticket] = values;
  localStorage.setItem('bellcorp_vehicle_meta', JSON.stringify(all));
}

function getOperator(token) {
  try {
    return JSON.parse(atob(token.split('.')[1] || '')).name || 'Operator';
  } catch {
    return 'Operator';
  }
}

function Brand({ inverse = false }) {
  return (
    <span className={`brand ${inverse ? 'brand-inverse' : ''}`}>
      <span className="brand-mark"><ParkingSquare size={19} strokeWidth={2.4} /></span>
      <span className="brand-name">BELLCORP<span> / PARKING</span></span>
    </span>
  );
}

function VehicleIcon({ type, size = 17 }) {
  const Icon = vehicleIcons[type] || CarFront;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <span className="input-wrap">{Icon && <Icon size={16} aria-hidden="true" />}{children}</span>
    </label>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('bellcorp_token'));
  const [page, setPage] = useState(token ? 'dashboard' : 'landing');
  const [authMode, setAuthMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [vehicle, setVehicle] = useState({ vehicleNumber: '', ownerName: '', phoneNumber: '', vehicleType: 'CAR' });
  const [data, setData] = useState(emptyData);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [exitTicket, setExitTicket] = useState('');
  const [foundTicket, setFoundTicket] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(null);
  const auth = { Authorization: `Bearer ${token}` };

  async function refresh() {
    setApiOnline(null);
    try {
      const [availability, active, history] = await Promise.all([
        request('/api/parking/availability', { headers: auth }),
        request('/api/parking/active', { headers: auth }),
        request('/api/parking/history', { headers: auth }),
      ]);
      setData({ availability: availability.availability, tickets: active.tickets, history: history.history.records });
      setApiOnline(true);
    } catch (requestError) {
      setApiOnline(false);
      throw requestError;
    }
  }

  useEffect(() => {
    if (token) refresh().catch((requestError) => setError(requestError.message));
  }, [token]);

  function clearMessages() {
    setError('');
    setNotice(null);
  }

  function showPage(next) {
    clearMessages();
    setPage(next);
  }

  function logout() {
    localStorage.removeItem('bellcorp_token');
    setToken(null);
    setData(emptyData);
    setPage('landing');
  }

  async function submitAuth(event) {
    event.preventDefault();
    clearMessages();
    if (authMode === 'register' && form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (authMode === 'register' && !/^\+?[0-9\s-]{10,15}$/.test(form.phone)) return setError('Enter a valid phone number.');
    setLoading(true);
    try {
      const payload = authMode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };
      const result = await request(`/api/auth/${authMode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (authMode === 'register') {
        setAuthMode('login');
        setForm({ ...form, password: '', confirmPassword: '' });
        setNotice('Account created. You can now sign in.');
      } else {
        localStorage.setItem('bellcorp_token', result.token);
        setToken(result.token);
        setPage('dashboard');
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function validateVehicle() {
    if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{3,4}$/.test(vehicle.vehicleNumber.replace(/\s/g, '').toUpperCase())) {
      return 'Enter a valid vehicle number, for example KA01AB1234.';
    }
    if (!vehicle.ownerName.trim()) return 'Owner name is required.';
    if (!/^\+?[0-9\s-]{10,15}$/.test(vehicle.phoneNumber)) return 'Enter a valid phone number.';
    return '';
  }

  async function park(event) {
    event.preventDefault();
    clearMessages();
    const validation = validateVehicle();
    if (validation) return setError(validation);
    setLoading(true);
    try {
      const result = await request('/api/parking/park', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          vehicleNumber: vehicle.vehicleNumber.replace(/\s/g, '').toUpperCase(),
          vehicleType: vehicle.vehicleType,
        }),
      });
      const ticket = result.ticket;
      saveVehicleMeta(ticket.ticketNumber, { ownerName: vehicle.ownerName, phoneNumber: vehicle.phoneNumber });
      setSelectedTicket(ticket);
      setVehicle({ ...vehicle, vehicleNumber: '' });
      await refresh();
      setPage('ticket');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function findExit(event) {
    event.preventDefault();
    clearMessages();
    const found = data.tickets.find((item) => item.ticket_number === exitTicket.trim().toUpperCase());
    if (!found) return setError('Active ticket not found. Check the ticket ID.');
    setFoundTicket(found);
  }

  async function completeExit() {
    clearMessages();
    setLoading(true);
    try {
      const result = await request('/api/parking/exit', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ ticketNumber: foundTicket.ticket_number }),
      });
      setSelectedTicket({
        ...result.exit,
        ticketNumber: result.exit.ticketNumber,
        vehicleNumber: result.exit.vehicleNumber,
        vehicleType: result.exit.vehicleType,
        slotNumber: result.exit.slotNumber,
        ownerName: vehicleMeta()[foundTicket.ticket_number]?.ownerName || 'Not recorded',
        phoneNumber: vehicleMeta()[foundTicket.ticket_number]?.phoneNumber || '-',
        exited: true,
      });
      await refresh();
      setPage('ticket');
      setFoundTicket(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadReceipt() {
    if (!selectedTicket) return;
    const ticket = selectedTicket;
    const id = ticket.ticketNumber || ticket.ticket_number;
    const text = `BELLCORP PARKING\n\nTicket ID: ${id}\nVehicle Number: ${ticket.vehicleNumber || ticket.vehicle_number}\nOwner Name: ${ticket.ownerName || vehicleMeta()[id]?.ownerName || '-'}\nPhone: ${ticket.phoneNumber || vehicleMeta()[id]?.phoneNumber || '-'}\nVehicle Type: ${ticket.vehicleType || ticket.vehicle_type}\nSlot: ${ticket.slotNumber || ticket.slot_number}\nEntry Date: ${formatDate(ticket.entryTime || ticket.entry_time)}\nEntry Time: ${formatTime(ticket.entryTime || ticket.entry_time)}\nStatus: ${ticket.exited ? 'COMPLETED' : 'PARKED'}\n${ticket.exited ? `Exit Time: ${formatTime(ticket.exitTime)}\nDuration: ${ticket.durationHours} hours\nFare: Rs ${ticket.fare}` : ''}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${id}-receipt.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!token && page === 'landing') {
    return <Landing onLogin={() => { setAuthMode('login'); showPage('auth'); }} onRegister={() => { setAuthMode('register'); showPage('auth'); }} />;
  }

  if (!token && page === 'auth') {
    return (
      <AuthPage
        mode={authMode} form={form} setForm={setForm} submit={submitAuth} loading={loading}
        error={error} notice={notice}
        onSwitch={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); clearMessages(); }}
        onBack={() => showPage('landing')}
      />
    );
  }

  if (page === 'ticket') {
    return <TicketPage ticket={selectedTicket} onDownload={downloadReceipt} onPrint={() => window.print()} onBack={() => showPage('dashboard')} />;
  }

  if (page === 'exit') {
    return (
      <ExitPage
        ticket={foundTicket} ticketNumber={exitTicket} setTicketNumber={setExitTicket}
        findExit={findExit} completeExit={completeExit} loading={loading} error={error}
        onBack={() => showPage('dashboard')}
      />
    );
  }

  return (
    <Dashboard
      operator={getOperator(token)} data={data} vehicle={vehicle} setVehicle={setVehicle}
      park={park} loading={loading} error={error} notice={notice} apiOnline={apiOnline}
      refresh={() => refresh().catch((requestError) => setError(requestError.message))}
      logout={logout} openExit={() => showPage('exit')}
      openTicket={(ticket) => {
        const meta = vehicleMeta()[ticket.ticket_number] || {};
        setSelectedTicket({ ...ticket, ownerName: meta.ownerName, phoneNumber: meta.phoneNumber });
        showPage('ticket');
      }}
      history={data.history}
    />
  );
}

function Landing({ onLogin, onRegister }) {
  const sampleRows = [
    { bay: 'B-01', type: 'BIKE', state: 'Available' },
    { bay: 'C-03', type: 'CAR', state: 'Occupied' },
    { bay: 'T-02', type: 'TRUCK', state: 'Available' },
  ];

  return (
    <main className="welcome-page">
      <header className="welcome-header"><Brand /><button className="button button-dark button-small" onClick={onLogin}>Operator sign in <ArrowUpRight size={15} /></button></header>
      <section className="welcome-hero">
        <div className="welcome-copy">
          <div className="overline"><span className="overline-dot" /> PARKING OPERATIONS / 01</div>
          <h1>Every bay.<br />In <span>good hands.</span></h1>
          <p>A clear view of arrivals, capacity, and every vehicle in your care. Start a shift with the whole lot in reach.</p>
          <div className="welcome-actions"><button className="button button-dark" onClick={onLogin}>Open control room <ArrowRight size={17} /></button><button className="button button-quiet" onClick={onRegister}>Create operator account</button></div>
          <div className="welcome-proof"><ShieldCheck size={16} /><span>Secure operator access</span><i /><span>Live capacity tracking</span></div>
        </div>
        <div className="welcome-preview" aria-label="Parking lot capacity preview">
          <div className="preview-head"><div><span className="micro-label">LOT SNAPSHOT</span><h2>Bellcorp Central</h2></div><span className="preview-status"><i /> CONFIGURED LOT</span></div>
          <div className="preview-stats"><div><span>Spaces</span><strong>12</strong></div><div><span>Vehicle classes</span><strong>03</strong></div><div><span>Control</span><strong>24<span className="preview-hours">/7</span></strong></div></div>
          <div className="preview-lanes">{sampleRows.map((row) => <div className={`preview-lane ${row.state === 'Occupied' ? 'preview-occupied' : ''}`} key={row.bay}><div className="preview-bay"><span>{row.bay}</span><VehicleIcon type={row.type} size={19} /></div><div className="preview-lane-info"><b>{row.type}</b><span>{row.state}</span></div><span className={`bay-indicator ${row.state === 'Occupied' ? 'indicator-occupied' : ''}`} /></div>)}</div>
          <div className="preview-road"><span>ENTRY</span><div className="road-centerline" /><ArrowRight size={18} /><span>EXIT</span></div>
          <div className="preview-foot"><span><MapPin size={14} /> BELLCORP CENTRAL / LEVEL 01</span><span>LOT ID 001</span></div>
        </div>
      </section>
      <section className="welcome-bottom"><span>ONE CONTROL ROOM</span><span>ARRIVALS, SLOT BY SLOT</span><span>RECEIPTS & AUDIT TRAIL</span><span>BUILT FOR THE FRONT DESK <ArrowUpRight size={14} /></span></section>
    </main>
  );
}

function AuthPage({ mode, form, setForm, submit, loading, error, notice, onSwitch, onBack }) {
  return (
    <main className="auth-page-new">
      <section className="auth-aside"><button className="auth-brand-button" onClick={onBack}><Brand inverse /></button><div className="auth-aside-main"><span className="overline overline-light">OPERATOR ACCESS / 01</span><div className="auth-number">{mode === 'login' ? '01' : '02'}</div><h1>{mode === 'login' ? <>Back to<br />the <span>floor.</span></> : <>Set up your<br /><span>control.</span></>}</h1><p>One secure workspace for the people who keep the lot moving.</p></div><div className="auth-aside-foot"><ShieldCheck size={16} /><span>Encrypted operator sessions</span></div><div className="auth-aside-pattern" /></section>
      <section className="auth-main">
        <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Back to home</button>
        <div className="auth-form-wrap">
          <div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={mode === 'login' ? undefined : onSwitch}>Sign in</button><button className={mode === 'register' ? 'active' : ''} onClick={mode === 'register' ? undefined : onSwitch}>Create account</button></div>
          <span className="micro-label">{mode === 'login' ? 'WELCOME BACK' : 'NEW OPERATOR'}</span>
          <h2>{mode === 'login' ? 'Sign in to your shift.' : 'Create an operator account.'}</h2>
          <p className="auth-intro">{mode === 'login' ? 'Enter your details to access the parking console.' : 'Your account gives you secure access to the Bellcorp lot.'}</p>
          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && <Field label="Full name" icon={UserRound}><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" autoComplete="name" required /></Field>}
            <Field label="Work email" icon={Mail}><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@company.com" autoComplete="email" required /></Field>
            {mode === 'register' && <Field label="Phone number" icon={Phone}><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="98765 43210" autoComplete="tel" required /></Field>}
            <Field label="Password" icon={ShieldCheck}><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 6 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="6" required /></Field>
            {mode === 'register' && <Field label="Confirm password" icon={ShieldCheck}><input type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} placeholder="Enter password again" autoComplete="new-password" required /></Field>}
            {notice && <p className="inline-message message-success"><Check size={16} />{notice}</p>}
            {error && <p className="inline-message message-error">{error}</p>}
            <button className="button button-dark auth-submit" disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Continue to console' : 'Create operator account'}<ArrowRight size={17} /></button>
          </form>
          <p className="auth-legal">Access is limited to authorized Bellcorp parking operators.</p>
        </div>
      </section>
    </main>
  );
}

function Dashboard({ operator, data, vehicle, setVehicle, park, loading, error, notice, apiOnline, refresh, logout, openExit, openTicket, history }) {
  const occupied = data.tickets.length;
  const totalSpaces = Object.values(CAPACITY).reduce((sum, count) => sum + count, 0);
  const occupancyRate = Math.round((occupied / totalSpaces) * 100);
  const [historyQuery, setHistoryQuery] = useState('');
  const filteredHistory = history.filter((item) => `${item.ticket_number} ${item.vehicle_number} ${item.vehicle_type}`.toLowerCase().includes(historyQuery.toLowerCase()));

  return (
    <main className="console-page">
      <header className="console-topbar">
        <Brand />
        <div className="topbar-center"><span className="console-location"><MapPin size={14} /> BELLCORP CENTRAL</span><span className="topbar-divider" /><span className="console-date"><CalendarDays size={14} /> {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
        <div className="topbar-actions"><span className={`system-status ${apiOnline === false ? 'system-offline' : ''}`}><i />{apiOnline === null ? 'CONNECTING' : apiOnline ? 'SYSTEM LIVE' : 'API OFFLINE'}</span><button className="icon-button" onClick={refresh} title="Refresh data" aria-label="Refresh data"><RefreshCw size={17} /></button><div className="operator-menu"><span className="operator-avatar">{operator.charAt(0).toUpperCase()}</span><span>{operator}</span></div><button className="icon-button logout-button" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button></div>
      </header>
      <div className="console-layout">
        <aside className="console-rail">
          <span className="rail-caption">WORKSPACE</span>
          <a className="rail-link rail-active" href="#overview"><Activity size={17} /><span>Overview</span><span className="rail-current" /></a>
          <a className="rail-link" href="#lot-map"><ParkingSquare size={17} /><span>Lot map</span></a>
          <a className="rail-link" href="#history"><Clock3 size={17} /><span>History</span></a>
          <span className="rail-caption rail-caption-bottom">ACTIONS</span>
          <button className="rail-link" onClick={openExit}><TicketCheck size={17} /><span>Vehicle exit</span><ChevronRight size={14} className="rail-arrow" /></button>
          <div className="rail-foot"><span className="rail-foot-mark"><ParkingSquare size={16} /></span><span>LOT 001<br /><b>12 REGISTERED BAYS</b></span></div>
        </aside>

        <section className="console-content" id="overview">
          <div className="content-heading"><div><div className="overline"><span className="overline-dot" /> SHIFT OVERVIEW</div><h1>Good shift, {operator.split(' ')[0]}.</h1><p>Here’s what’s happening across the lot right now.</p></div><div className="heading-actions"><span className="last-updated"><Activity size={14} />{apiOnline === null ? 'CONNECTING...' : apiOnline ? 'LIVE OPERATIONS' : 'SERVICE DISCONNECTED'}</span><button className="button button-outline button-small" onClick={refresh}><RefreshCw size={15} /> Refresh</button></div></div>
          {(error || notice) && <div className={`console-alert ${error ? 'alert-error' : 'alert-success'}`} role="status">{error || notice}</div>}

          <section className="metric-grid" aria-label="Lot summary">
            <article className="metric-card metric-total"><div className="metric-label">CURRENTLY PARKED <span><Activity size={15} /></span></div><div className="metric-main"><strong>{String(occupied).padStart(2, '0')}</strong><small>of {totalSpaces} spaces</small></div><div className="metric-progress"><span style={{ width: `${occupancyRate}%` }} /></div><div className="metric-foot"><span>LOT OCCUPANCY</span><b>{occupancyRate}%</b></div></article>
            {TYPES.map((type) => <article className={`metric-card metric-${type.toLowerCase()}`} key={type}><div className="metric-label"><span className="metric-vehicle-icon"><VehicleIcon type={type} size={16} /></span>{type} SPACES</div><div className="metric-main"><strong>{data.availability[type]}</strong><small>available</small></div><div className="metric-foot"><span>CAPACITY</span><b>{String(CAPACITY[type]).padStart(2, '0')} BAYS</b></div></article>)}
          </section>

          <section className="work-grid">
            <section className="lot-panel" id="lot-map">
              <div className="section-heading"><div><span className="micro-label">FLOOR PLAN / LEVEL 01</span><h2>Live lot map</h2></div><div className="map-legend"><span><i className="legend-free" /> Available</span><span><i className="legend-taken" /> Occupied</span></div></div>
              <div className="map-toolbar"><span><MapPin size={14} /> NORTH ENTRY</span><span>12 BAYS TOTAL</span></div>
              <div className="lot-map">
                {TYPES.map((type) => {
                  const Icon = vehicleIcons[type];
                  return <div className={`map-row map-${type.toLowerCase()}`} key={type}><div className="map-row-label"><span className="map-type-icon"><Icon size={17} /></span><div><b>{type}</b><small>{CAPACITY[type]} bays</small></div></div><div className="map-spaces">{Array.from({ length: CAPACITY[type] }, (_, index) => {
                    const slot = index + 1;
                    const ticket = data.tickets.find((item) => item.vehicle_type === type && Number(item.slot_number) === slot);
                    return <button className={`parking-bay ${ticket ? 'bay-taken' : 'bay-free'}`} onClick={() => ticket && openTicket(ticket)} key={slot} disabled={!ticket} title={ticket ? `View ${ticket.vehicle_number}` : 'Available bay'}><span className="bay-number">{type[0]}-{String(slot).padStart(2, '0')}</span>{ticket ? <><Icon className="bay-car-icon" size={20} /><b className="bay-plate">{ticket.vehicle_number}</b></> : <span className="bay-free-label">OPEN</span>}</button>;
                  })}</div></div>;
                })}
              </div>
              <div className="map-exit-lane"><span>IN</span><div /><ArrowRight size={17} /><span>OUT</span></div>
              <div className="lot-panel-foot"><span className={apiOnline === false ? 'service-down' : ''}><i />{apiOnline === null ? 'Connecting to parking service' : apiOnline ? 'Synced with parking service' : 'Parking service unavailable'}</span><button onClick={refresh}>Update map <ArrowUpRight size={14} /></button></div>
            </section>

            <aside className="intake-panel">
              <div className="intake-heading"><span className="intake-icon"><CarFront size={18} /></span><span className="micro-label">FRONT DESK / ARRIVAL</span></div>
              <h2>New arrival<span>.</span></h2><p>Register the vehicle and assign its bay.</p>
              <form onSubmit={park} className="intake-form">
                <Field label="Registration plate"><input value={vehicle.vehicleNumber} onChange={(event) => setVehicle({ ...vehicle, vehicleNumber: event.target.value.toUpperCase() })} placeholder="KA01AB1234" autoComplete="off" required /></Field>
                <label className="form-field"><span>Vehicle class</span><span className="select-wrap"><select value={vehicle.vehicleType} onChange={(event) => setVehicle({ ...vehicle, vehicleType: event.target.value })}><option value="CAR">Car</option><option value="BIKE">Motorcycle</option><option value="TRUCK">Truck</option></select><ChevronRight size={15} /></span></label>
                <div className="form-two"><Field label="Owner name"><input value={vehicle.ownerName} onChange={(event) => setVehicle({ ...vehicle, ownerName: event.target.value })} placeholder="Full name" autoComplete="name" required /></Field><Field label="Phone"><input value={vehicle.phoneNumber} onChange={(event) => setVehicle({ ...vehicle, phoneNumber: event.target.value })} placeholder="Phone number" autoComplete="tel" required /></Field></div>
                <button className="button button-lime intake-submit" disabled={loading}>{loading ? 'Assigning bay...' : 'Park vehicle'}<ArrowRight size={17} /></button>
              </form>
              <div className="intake-aux"><span><ShieldCheck size={14} /> Slot assignment is secured</span><button onClick={openExit}>Process an exit <ArrowUpRight size={14} /></button></div>
            </aside>
          </section>

          <section className="history-panel" id="history">
            <div className="section-heading history-heading"><div><span className="micro-label">RECENT DEPARTURES</span><h2>Parking history</h2></div><label className="history-search"><Search size={15} /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search plate or ticket" aria-label="Search parking history" /></label></div>
            {filteredHistory.length ? <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Ticket reference</th><th>Vehicle</th><th>Class</th><th>Bay</th><th>Exit time</th><th>Fare</th></tr></thead><tbody>{filteredHistory.slice(0, 8).map((item) => <tr key={item.ticket_number}><td className="history-ticket">{item.ticket_number}</td><td>{item.vehicle_number}</td><td><span className={`type-tag type-${item.vehicle_type.toLowerCase()}`}><VehicleIcon type={item.vehicle_type} size={13} />{item.vehicle_type}</span></td><td>{item.slot_number}</td><td>{formatTime(item.exit_time)}</td><td className="history-fare">Rs {item.fare}</td></tr>)}</tbody></table></div> : <div className="history-empty"><Clock3 size={20} /><span>{historyQuery ? 'No departures match that search.' : 'Completed visits will appear here.'}</span></div>}
            <div className="history-foot"><span>Showing {Math.min(filteredHistory.length, 8)} of {filteredHistory.length} records</span><span>RECORDS ARE STORED SECURELY</span></div>
          </section>
          <footer className="console-footer"><span>© BELLCORP PARKING OPERATIONS</span><span>CONTROL ROOM <i /> 001 / CENTRAL</span></footer>
        </section>
      </div>
    </main>
  );
}

function ExitPage({ ticket, ticketNumber, setTicketNumber, findExit, completeExit, loading, error, onBack }) {
  return (
    <main className="utility-page"><header className="utility-topbar"><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Control room</button><Brand /><span className="utility-tag">VEHICLE DEPARTURE</span></header><div className="utility-content"><div className="utility-intro"><span className="overline"><span className="overline-dot" /> FRONT DESK / EXIT</span><h1>Clear the<br /><span>way out.</span></h1><p>Find the active ticket, review the visit, and complete the departure.</p></div><section className="utility-card"><div className="utility-card-head"><span className="utility-card-icon"><TicketCheck size={20} /></span><div><span className="micro-label">ACTIVE VISIT LOOKUP</span><h2>Find a vehicle</h2></div></div><form onSubmit={findExit} className="exit-form"><Field label="Ticket reference"><input value={ticketNumber} onChange={(event) => setTicketNumber(event.target.value.toUpperCase())} placeholder="BELL-..." autoComplete="off" required /></Field><button className="button button-dark">Find ticket <ArrowRight size={17} /></button></form>{error && <p className="inline-message message-error">{error}</p>}{ticket && <div className="exit-details"><div className="exit-details-heading"><span className="status-pill status-active"><i /> ACTIVE VISIT</span><span className="micro-label">BAY {ticket.slot_number}</span></div><strong className="exit-plate">{ticket.vehicle_number}</strong><div className="exit-detail-grid"><div><small>VEHICLE CLASS</small><b><VehicleIcon type={ticket.vehicle_type} size={15} /> {ticket.vehicle_type}</b></div><div><small>ENTRY TIME</small><b><Clock3 size={15} /> {formatTime(ticket.entry_time)}</b></div><div><small>TICKET</small><b>{ticket.ticket_number}</b></div><div><small>DATE</small><b>{formatDate(ticket.entry_time)}</b></div></div><button className="button button-lime exit-complete" onClick={completeExit} disabled={loading}>{loading ? 'Completing departure...' : 'Calculate fare & clear bay'}<ArrowRight size={17} /></button></div>}<div className="utility-card-foot"><ShieldCheck size={15} /> Fare is calculated by the parking service.</div></section></div></main>
  );
}

function TicketPage({ ticket, onDownload, onPrint, onBack }) {
  if (!ticket) return null;
  const id = ticket.ticketNumber || ticket.ticket_number;
  const meta = vehicleMeta()[id] || {};
  const vehicleNumber = ticket.vehicleNumber || ticket.vehicle_number;
  const vehicleType = ticket.vehicleType || ticket.vehicle_type;
  const slotNumber = ticket.slotNumber || ticket.slot_number;

  return (
    <main className="ticket-page-new"><header className="utility-topbar"><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Control room</button><Brand /><span className="utility-tag">VISIT RECEIPT</span></header><div className="receipt-layout"><div className="receipt-copy"><span className="overline"><span className="overline-dot" /> {ticket.exited ? 'DEPARTURE COMPLETE' : 'ARRIVAL REGISTERED'}</span><h1>{ticket.exited ? <>All clear<span>.</span></> : <>Bay assigned<span>.</span></>}</h1><p>{ticket.exited ? 'The visit is complete and the bay is ready for the next arrival.' : 'The vehicle is checked in. Here are the visit details for your records.'}</p><div className="receipt-actions"><button className="button button-dark" onClick={onDownload}><Download size={16} /> Download receipt</button><button className="button button-outline" onClick={onPrint}><Printer size={16} /> Print</button></div><button className="receipt-back-link" onClick={onBack}><ArrowLeft size={15} /> Return to control room</button></div><article className="receipt-document"><div className="receipt-doc-top"><Brand /><span className={`status-pill ${ticket.exited ? 'status-done' : 'status-active'}`}><i /> {ticket.exited ? 'COMPLETED' : 'PARKED'}</span></div><div className="receipt-ref"><span className="micro-label">TICKET REFERENCE</span><strong>{id}</strong></div><div className="receipt-car"><span><VehicleIcon type={vehicleType} size={18} /></span><div><b>{vehicleNumber}</b><small>{vehicleType} / BAY {slotNumber}</small></div><Check size={18} /></div><div className="receipt-data-grid"><div><small>OWNER</small><b>{ticket.ownerName || meta.ownerName || '-'}</b></div><div><small>CONTACT</small><b>{ticket.phoneNumber || meta.phoneNumber || '-'}</b></div><div><small>ARRIVAL DATE</small><b>{formatDate(ticket.entryTime || ticket.entry_time)}</b></div><div><small>ARRIVAL TIME</small><b>{formatTime(ticket.entryTime || ticket.entry_time)}</b></div>{ticket.exited && <><div><small>DEPARTURE</small><b>{formatTime(ticket.exitTime)}</b></div><div><small>DURATION</small><b>{ticket.durationHours} hours</b></div></>}</div>{ticket.exited && <div className="receipt-total"><span>TOTAL FARE</span><strong>Rs {ticket.fare}</strong></div>}<div className="receipt-doc-foot"><span>BELLCORP CENTRAL / PARKING OPERATIONS</span><span>THANK YOU</span></div></article></div></main>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);