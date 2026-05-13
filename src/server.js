import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';
import taskRoutes from './routes/taskRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import adaptiveRoutes from './routes/adaptiveRoutes.js';
import guidanceRoutes from './routes/guidanceRoutes.js';
import authRoutes from './routes/authRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import showcaseRoutes from './routes/showcaseRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import { connectDB } from './config/database.js';
import TaskPlanService from './services/taskPlanService.js';
import { existsSync } from 'fs';
import { join } from 'path';

dotenv.config();

// Initialize TaskPlanService with available API keys
TaskPlanService.initializeGroqKeys();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5050;
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const corsOptions = corsOrigins.length
  ? { origin: corsOrigins, credentials: true }
  : { origin: true, credentials: false };

// Middleware
app.use(helmet());
app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
connectDB().catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'SmartAssist Backend'
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SmartAssist Backend',
    health: '/api/health'
  });
});

// Routes
app.use('/api/v1/task', taskRoutes);
app.use('/api/v1/session', sessionRoutes);
app.use('/api/v1/adaptive', adaptiveRoutes);
app.use('/api/v1/guidance', guidanceRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/showcase', showcaseRoutes);

const frontendDist = join(process.cwd(), 'frontend', 'dist');
const escapeHtml = (value = '') => value
  .toString()
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const showcaseHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JUS'TAPP | Adaptive AI Showcase</title>
  <meta name="description" content="Adaptive AI-powered smartphone assistance framework showcase." />
  <style>
    :root { color-scheme: light; background: linear-gradient(180deg, #f7efe6 0%, #f2e6d9 100%); }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; min-height: 100vh; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #2f241c; background: #f4ede4; }
    button, input { font: inherit; }
    button { cursor: pointer; }
    #root { min-height: 100vh; }
    .page-shell { min-height: 100vh; padding: 24px 16px 40px; max-width: 1120px; margin: 0 auto; }
    .card { border: 1px solid rgba(120, 92, 68, 0.14); background: rgba(255, 250, 244, 0.96); box-shadow: 0 8px 20px rgba(67, 47, 32, 0.05); border-radius: 28px; }
    .hero { padding: 40px 24px; text-align: center; }
    .eyebrow, .section-label { text-transform: uppercase; letter-spacing: 0.28em; font-size: 0.72rem; color: #8d755f; }
    h1 { margin: 14px 0 0; font-size: clamp(3rem, 8vw, 5.5rem); line-height: 0.95; }
    .hero-copy { max-width: 760px; margin: 16px auto 0; color: #6f5b4d; font-size: 1.05rem; line-height: 1.9; }
    .composer { display: grid; gap: 12px; grid-template-columns: 1fr auto; align-items: end; max-width: 760px; margin: 28px auto 0; }
    .field { display: grid; gap: 8px; text-align: left; color: #6f5b4d; font-size: 0.92rem; }
    .field input { height: 56px; border-radius: 18px; border: 1px solid #ddcfc2; background: #fffaf4; padding: 0 16px; color: #2f241c; outline: none; }
    .field input:focus { border-color: #7c5f47; box-shadow: 0 0 0 3px rgba(124,95,71,0.08); }
    .primary-btn { height: 56px; border: 0; border-radius: 18px; padding: 0 20px; background: #3a2a20; color: #f7efe6; }
    .preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
    .preset-chip { width: 100%; min-height: 56px; border-radius: 18px; border: 1px solid #d8c4b2; background: rgba(255,255,255,0.8); padding: 12px 16px; color: #5f4c3d; text-align: center; box-shadow: 0 4px 10px rgba(67,47,32,0.04); }
    .grid-3 { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 16px; }
    .user-card { position: relative; overflow: hidden; padding: 20px; }
    .user-card h2 { margin: 0; font-size: 1.1rem; }
    .user-description, .panel-note { color: #6f5b4d; line-height: 1.65; font-size: 0.93rem; }
    .pill { border-radius: 999px; border: 1px solid #d8c4b2; background: #fff9f3; color: #6f5b4d; padding: 7px 12px; font-size: 0.84rem; }
    .stack { display: grid; gap: 14px; }
    .steps { display: grid; gap: 10px; margin-top: 14px; }
    .step-card { display: flex; gap: 12px; align-items: start; border: 1px solid #eadfce; border-radius: 20px; background: rgba(255,255,255,0.96); padding: 14px; }
    .step-index { width: 32px; height: 32px; border-radius: 999px; background: #6a4b33; color: #fff8f1; display: grid; place-items: center; font-size: 0.82rem; flex: 0 0 auto; }
    .step-text { line-height: 1.7; }
    .result-grid { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 16px; }
    .result-card { padding: 16px; }
    .center { text-align: center; }
    .muted { color: #8d755f; font-size: 0.84rem; }
    @media (max-width: 900px) {
      .composer, .grid-3, .result-grid, .preset-grid { grid-template-columns: 1fr; }
      .hero { padding: 28px 18px; }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    const escapeHtml = (value = '') => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const presets = ['Book a cab to the airport', 'Send a WhatsApp message', 'Order food online', 'Recharge mobile number'];
    const users = [
      { key: 'independent', title: 'Independent User', detail: 'Concise', description: 'For users comfortable with smartphone applications.' },
      { key: 'assisted', title: 'Assisted User', detail: 'Balanced', description: 'For users who need moderate smartphone guidance.' },
      { key: 'guided', title: 'Guided User', detail: 'Highly detailed', description: 'For elderly or digitally inexperienced users.' }
    ];

    const render = (state = { taskDescription: '', loading: false, results: null, error: '' }) => {
      const plans = state.results || {};
      document.getElementById('root').innerHTML = \`
        <div class="page-shell">
          <section class="card hero">
            <div class="eyebrow">Adaptive smartphone guidance</div>
            <h1>JUS'TAPP</h1>
            <p class="hero-copy">JUS’TAPP helps users complete smartphone tasks using intelligent step-by-step guidance that adapts according to user understanding and interaction behavior.</p>
            <div class="composer">
              <label class="field">
                <span>Task input</span>
                <input id="task-input" value="\${escapeHtml(state.taskDescription)}" placeholder="Try something like 'Book a cab to the airport'" />
              </label>
              <button id="generate-btn" class="primary-btn">\${state.loading ? 'Generating…' : 'Generate Guidance'}</button>
            </div>
            <div class="preset-grid">
              \${presets.map((p) => \`<button class="preset-chip" data-preset="\${escapeHtml(p)}">\${escapeHtml(p)}</button>\`).join('')}
            </div>
          </section>
          <section class="grid-3">
            \${users.map((user) => \`
              <article class="card user-card">
                <div class="section-label">\${user.key}</div>
                <h2>\${user.title}</h2>
                <div class="pill" style="float:right; margin-top:-28px;">\${user.detail}</div>
                <p class="user-description">\${user.description}</p>
              </article>
            \`).join('')}
          </section>
          <section class="card" style="padding:24px; margin-top:16px;">
            <div class="section-label">Selected user type</div>
            <div style="display:flex; justify-content:space-between; gap:16px; align-items:start; flex-wrap:wrap;">
              <div>
                <div style="font-size:1.8rem; font-weight:700; margin-top:8px;">Guided User</div>
                <div class="pill" style="display:inline-block; margin-top:12px;">Highly detailed</div>
              </div>
              <div style="min-width:280px; flex:1;">
                <div class="section-label">Task input</div>
                <div class="card" style="padding:12px 16px; margin-top:10px; background:#fff;">\${escapeHtml(state.taskDescription || 'Book a cab to the airport')}</div>
              </div>
            </div>
          </section>
          <section class="card" style="padding:24px; margin-top:16px;">
            <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; flex-wrap:wrap;">
              <div>
                <div class="section-label">Adaptive guidance</div>
                <div style="font-size:1.4rem; font-weight:700; margin-top:8px;">Generated plans</div>
              </div>
              \${state.loading ? '<div class="pill">Generating…</div>' : ''}
            </div>
            \${state.error ? \`<div class="card" style="padding:12px 16px; margin-top:16px; background:#fff0f0; color:#b91c1c;">\${escapeHtml(state.error)}</div>\` : ''}
            <div class="result-grid">
              \${users.map((user) => {
                const plan = plans[user.key];
                return \`
                  <article class="card result-card">
                    <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
                      <div>
                        <div style="font-size:0.95rem; font-weight:600;">\${user.title}</div>
                        <div class="muted">\${user.detail}</div>
                      </div>
                      <div class="pill">\${plan?.steps?.length || 0} steps</div>
                    </div>
                    \${plan ? \`
                      <div class="stack">
                        <div class="card" style="padding:12px 14px; background:#fff; margin-top:14px;">\${escapeHtml(plan.appPackageName || 'Smartphone task')}</div>
                        <div class="steps">
                          \${plan.steps.map((step, index) => \`
                            <div class="step-card">
                              <div class="step-index">\${index + 1}</div>
                              <div class="step-text">\${escapeHtml(step.instruction || '')}</div>
                            </div>
                          \`).join('')}
                        </div>
                      </div>
                    \` : \`
                      <div class="card" style="padding:14px; margin-top:14px; text-align:center; color:#8d755f;">Generate once to populate this card.</div>
                    \`}
                  </article>
                \`;
              }).join('')}
            </div>
          </section>
        </div>\`;

      document.getElementById('generate-btn').onclick = async () => {
        const input = document.getElementById('task-input');
        const taskDescription = input.value.trim();
        if (!taskDescription) return;
        state.taskDescription = taskDescription;
        state.loading = true;
        state.error = '';
        render(state);
        try {
          const response = await fetch('/api/v1/showcase/adaptive-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskDescription, language: 'en' })
          });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || 'Failed to generate guidance');
          state.results = data.plans || {};
        } catch (err) {
          state.error = err.message;
        } finally {
          state.loading = false;
          render(state);
        }
      };

      document.querySelectorAll('[data-preset]').forEach((button) => {
        button.onclick = () => {
          state.taskDescription = button.getAttribute('data-preset') || '';
          render(state);
        };
      });
    };

    render();
  </script>
</body>
</html>`;

app.get('/showcase', (req, res) => {
  res.type('html').send(showcaseHtml);
});

app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return res.type('html').send(showcaseHtml);
  }
  return next();
});

// Error Handler
app.use(errorHandler);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`SmartAssist Backend running on 0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

export default app;
