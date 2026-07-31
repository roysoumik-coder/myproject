const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const port = Number(process.env.PORT || 3000);
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'students.json');

const initialStudents = [
  {
    id: 'stu-1001',
    name: 'Ananya Sharma',
    email: 'ananya.sharma@example.com',
    course: 'DevSecOps',
    year: '3rd Year',
    status: 'Active',
  },
  {
    id: 'stu-1002',
    name: 'Rahul Mehta',
    email: 'rahul.mehta@example.com',
    course: 'Cloud Security',
    year: '4th Year',
    status: 'Active',
  },
  {
    id: 'stu-1003',
    name: 'Sara Khan',
    email: 'sara.khan@example.com',
    course: 'Secure Coding',
    year: '2nd Year',
    status: 'On Hold',
  },
];

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o750 });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(initialStudents, null, 2), { mode: 0o640 });
  }
}

function readStudents() {
  ensureStore();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeStudents(students) {
  fs.writeFileSync(dataFile, JSON.stringify(students, null, 2));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(new URLSearchParams(body)));
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function validateStudent(form) {
  const student = {
    name: String(form.get('name') || '').trim(),
    email: String(form.get('email') || '').trim().toLowerCase(),
    course: String(form.get('course') || '').trim(),
    year: String(form.get('year') || '').trim(),
    status: String(form.get('status') || '').trim(),
  };

  const errors = [];
  if (student.name.length < 2) errors.push('Name must contain at least 2 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) errors.push('Enter a valid email address.');
  if (student.course.length < 2) errors.push('Course must contain at least 2 characters.');
  if (!['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(student.year)) errors.push('Choose a valid year.');
  if (!['Active', 'On Hold', 'Graduated'].includes(student.status)) errors.push('Choose a valid status.');

  return { student, errors };
}

function layout({ students, errors = [], values = {}, notice = '' }) {
  const total = students.length;
  const active = students.filter((student) => student.status === 'Active').length;
  const courses = new Set(students.map((student) => student.course)).size;

  const rows = students
    .map(
      (student) => `
        <tr>
          <td><strong>${escapeHtml(student.name)}</strong><span>${escapeHtml(student.email)}</span></td>
          <td>${escapeHtml(student.course)}</td>
          <td>${escapeHtml(student.year)}</td>
          <td><span class="badge ${student.status === 'Active' ? 'active' : ''}">${escapeHtml(student.status)}</span></td>
          <td>
            <form method="post" action="/students/${encodeURIComponent(student.id)}/delete">
              <button class="icon-button" type="submit" title="Delete ${escapeHtml(student.name)}">Delete</button>
            </form>
          </td>
        </tr>`,
    )
    .join('');

  const errorPanel = errors.length
    ? `<div class="alert">${errors.map((error) => `<p>${escapeHtml(error)}</p>`).join('')}</div>`
    : '';
  const noticePanel = notice ? `<div class="notice">${escapeHtml(notice)}</div>` : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Student Management System CD/CI</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #17212b;
        --muted: #5d6b78;
        --line: #d8e0e8;
        --panel: #ffffff;
        --soft: #f4f7fa;
        --navy: #163d59;
        --teal: #14796f;
        --amber: #d99a21;
        --red: #b33a3a;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ink);
        background: #eef3f6;
      }

      header {
        background: var(--navy);
        color: #fff;
        padding: 24px clamp(18px, 4vw, 44px);
      }

      .topbar {
        max-width: 1180px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
      }

      .brand strong {
        display: block;
        font-size: clamp(1.35rem, 2.8vw, 2.1rem);
        letter-spacing: 0;
      }

      .brand span {
        display: block;
        margin-top: 4px;
        color: rgba(255, 255, 255, 0.78);
      }

      .health {
        border: 1px solid rgba(255, 255, 255, 0.28);
        border-radius: 8px;
        padding: 10px 12px;
        color: rgba(255, 255, 255, 0.86);
      }

      main {
        max-width: 1180px;
        margin: 0 auto;
        padding: 28px clamp(18px, 4vw, 44px) 46px;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 18px;
      }

      .stat, .form-panel, .table-panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 8px;
      }

      .stat {
        padding: 18px;
      }

      .stat span {
        color: var(--muted);
        font-size: 0.92rem;
      }

      .stat strong {
        display: block;
        margin-top: 7px;
        font-size: 2rem;
      }

      .grid {
        display: grid;
        grid-template-columns: 360px minmax(0, 1fr);
        gap: 18px;
        align-items: start;
      }

      .form-panel, .table-panel {
        overflow: hidden;
      }

      .panel-title {
        padding: 16px 18px;
        border-bottom: 1px solid var(--line);
        background: var(--soft);
        font-weight: 800;
      }

      form.create {
        padding: 18px;
        display: grid;
        gap: 12px;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 0.9rem;
      }

      input, select {
        width: 100%;
        min-height: 42px;
        border: 1px solid #c4ced8;
        border-radius: 6px;
        padding: 0 11px;
        font: inherit;
        color: var(--ink);
        background: #fff;
      }

      button {
        min-height: 42px;
        border: 0;
        border-radius: 6px;
        padding: 0 14px;
        font: inherit;
        font-weight: 800;
        color: #fff;
        background: var(--teal);
        cursor: pointer;
      }

      .icon-button {
        min-height: 34px;
        color: #fff;
        background: var(--red);
        font-size: 0.86rem;
      }

      .alert, .notice {
        margin: 0 18px 14px;
        padding: 11px 12px;
        border-radius: 6px;
      }

      .alert {
        border: 1px solid #efb6b6;
        background: #fff0f0;
        color: #7f2424;
      }

      .alert p {
        margin: 0 0 6px;
      }

      .alert p:last-child {
        margin-bottom: 0;
      }

      .notice {
        border: 1px solid #b8dbc9;
        background: #eefaf4;
        color: #0c5b41;
      }

      .table-wrap {
        width: 100%;
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 720px;
      }

      th, td {
        padding: 14px 16px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: middle;
      }

      th {
        color: var(--muted);
        background: #fbfcfd;
        font-size: 0.86rem;
      }

      td span {
        display: block;
        margin-top: 3px;
        color: var(--muted);
        font-size: 0.88rem;
      }

      .badge {
        display: inline-block;
        margin: 0;
        padding: 5px 9px;
        border-radius: 999px;
        color: #7a4d04;
        background: #fff3d6;
        font-weight: 800;
        font-size: 0.82rem;
      }

      .badge.active {
        color: #0e5944;
        background: #ddf6eb;
      }

      @media (max-width: 860px) {
        .stats, .grid {
          grid-template-columns: 1fr;
        }

        .topbar {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="topbar">
        <div class="brand">
          <strong>Student Management System</strong>
          <span>Manage students, courses, years, and enrollment status.</span>
        </div>
        <div class="health">Live app health: OK</div>
      </div>
    </header>
    <main>
      <section class="stats" aria-label="Student summary">
        <div class="stat"><span>Total Students</span><strong>${total}</strong></div>
        <div class="stat"><span>Active Students</span><strong>${active}</strong></div>
        <div class="stat"><span>Courses</span><strong>${courses}</strong></div>
      </section>

      <section class="grid">
        <aside class="form-panel">
          <div class="panel-title">Add Student</div>
          ${noticePanel}
          ${errorPanel}
          <form class="create" method="post" action="/students">
            <label>Name
              <input name="name" required minlength="2" value="${escapeHtml(values.name || '')}" />
            </label>
            <label>Email
              <input type="email" name="email" required value="${escapeHtml(values.email || '')}" />
            </label>
            <label>Course
              <input name="course" required minlength="2" value="${escapeHtml(values.course || '')}" />
            </label>
            <label>Year
              <select name="year" required>
                ${['1st Year', '2nd Year', '3rd Year', '4th Year']
                  .map((year) => `<option ${values.year === year ? 'selected' : ''}>${year}</option>`)
                  .join('')}
              </select>
            </label>
            <label>Status
              <select name="status" required>
                ${['Active', 'On Hold', 'Graduated']
                  .map((status) => `<option ${values.status === status ? 'selected' : ''}>${status}</option>`)
                  .join('')}
              </select>
            </label>
            <button type="submit">Save Student</button>
          </form>
        </aside>

        <section class="table-panel">
          <div class="panel-title">Student Records</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="5">No students yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  </body>
</html>`;
}

function jsonResponse(res, status, payload) {
  send(res, status, JSON.stringify(payload, null, 2), 'application/json; charset=utf-8');
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return jsonResponse(res, 200, { status: 'ok', service: 'student-management-system' });
  }

  if (req.method === 'GET' && url.pathname === '/api/students') {
    return jsonResponse(res, 200, readStudents());
  }

  if (req.method === 'GET' && url.pathname === '/') {
    const students = readStudents();
    return send(res, 200, layout({ students, notice: url.searchParams.get('notice') || '' }));
  }

  if (req.method === 'POST' && url.pathname === '/students') {
    const form = await parseBody(req);
    const { student, errors } = validateStudent(form);
    const students = readStudents();

    if (students.some((existing) => existing.email === student.email)) {
      errors.push('A student with this email already exists.');
    }

    if (errors.length) {
      return send(res, 400, layout({ students, errors, values: student }));
    }

    students.push({ id: `stu-${crypto.randomUUID()}`, ...student });
    writeStudents(students);
    return redirect(res, '/?notice=Student%20added%20successfully');
  }

  const deleteMatch = url.pathname.match(/^\/students\/([^/]+)\/delete$/);
  if (req.method === 'POST' && deleteMatch) {
    const id = decodeURIComponent(deleteMatch[1]);
    const students = readStudents().filter((student) => student.id !== id);
    writeStudents(students);
    return redirect(res, '/?notice=Student%20deleted%20successfully');
  }

  return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    send(res, 500, 'Internal server error', 'text/plain; charset=utf-8');
  });
});

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Student Management System running on http://localhost:${port}`);
  });
}

module.exports = { server, validateStudent, escapeHtml };
