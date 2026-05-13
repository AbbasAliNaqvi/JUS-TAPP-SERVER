# Backend Development Guide

## Project Structure

```
src/
├── config/
│   └── database.js          # MongoDB connection
├── models/
│   └── Task.js              # Mongoose schemas
├── routes/
│   ├── taskRoutes.js        # Task endpoints
│   └── sessionRoutes.js     # Session endpoints
├── controllers/
│   └── taskController.js    # Route handlers
├── services/
│   └── taskPlanService.js   # LLM integration
├── middleware/
│   └── errorHandler.js      # Error handling
└── server.js               # Express app
```

## Key Features

### 1. Multi-Provider LLM Support

The `TaskPlanService` supports:
- **Gemini API** (Google's latest LLM)
- **Groq API** (Fast inference)
- **Ollama** (Local LLM, no API key needed)

Automatically falls back if one provider fails.

### 2. Adaptive Intelligence Layer

The backend now supports behavior-aware guidance for the existing Kotlin Android app:

- Interaction event logging from Accessibility Service
- Confusion prediction across four assistance levels
- Adaptive overlay instructions based on user behavior
- Guidance versions for analytics and debugging
- ML training/TFLite workflow for future model upgrades

Kotlin integration contract: [`API_HANDOFF_FOR_KOTLIN.md`](./API_HANDOFF_FOR_KOTLIN.md)

ML pipeline guide: [`ML_PIPELINE.md`](./ML_PIPELINE.md)

### 3. Task Planning

Takes natural language input:
```
"Book a cab to Rajouri Garden"
```

Returns structured plan:
```json
{
  "taskId": "uuid",
  "appPackageName": "com.ubercab",
  "steps": [...],
  "estimatedDuration": 180
}
```

### 4. Session Tracking

Stores:
- Task execution history
- User interaction patterns
- Error logs
- Performance metrics

## API Endpoints

### Generate Task Plan
```bash
POST /api/v1/task/plan
Content-Type: application/json

{
  "taskDescription": "Book a cab to Rajouri Garden",
  "userId": "user-123",
  "language": "en"
}
```

Response:
```json
{
  "success": true,
  "plan": {
    "taskId": "task-uuid",
    "description": "Book a cab to Rajouri Garden",
    "appPackageName": "com.ubercab",
    "steps": [
      {
        "stepIndex": 0,
        "instruction": "Open Uber app",
        "actionType": "tap",
        "targetElement": "Uber Icon"
      }
    ],
    "estimatedDuration": 180
  }
}
```

### Get Task
```bash
GET /api/v1/task/:taskId
```

### Update Task Step
```bash
PUT /api/v1/task/:taskId/step/:stepIndex
Content-Type: application/json

{
  "status": "completed"
}
```

### Get User Tasks
```bash
GET /api/v1/task/user/:userId?limit=20&skip=0
```

### Create Session
```bash
POST /api/v1/session
Content-Type: application/json

{
  "userId": "user-123",
  "taskId": "task-456",
  "deviceInfo": {
    "osVersion": "13",
    "screenSize": "6.1 inches"
  }
}
```

### Update Session
```bash
PUT /api/v1/session/:sessionId
Content-Type: application/json

{
  "sessionEndTime": "2024-05-11T20:30:00Z",
  "stepsCompleted": 5,
  "success": true,
  "notes": "User completed task successfully"
}
```

### Get User Sessions
```bash
GET /api/v1/session/user/:userId?limit=50
```

## Development

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

Starts on `http://localhost:5000` with auto-reload.

### Environment Variables
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/smartassist

# LLM APIs (use one)
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
OPENAI_API_KEY=your_key

# Local LLM
OLLAMA_BASE_URL=http://localhost:11434/api
OLLAMA_MODEL=llama2

# Security
JWT_SECRET=your_jwt_secret

# CORS
CORS_ORIGIN=http://localhost:3000,http://10.0.2.2:5000
```

### Database

MongoDB Collections:
- `tasks` - Task definitions and progress
- `sessions` - User sessions and history
- `templates` - Task templates

### Testing Endpoints

Test task planning:
```bash
curl -X POST http://localhost:5000/api/v1/task/plan \
  -H "Content-Type: application/json" \
  -d '{
    "taskDescription": "Send message on WhatsApp",
    "userId": "test-user"
  }'
```

Test health:
```bash
curl http://localhost:5000/api/health
```

## Docker Deployment

### Build Image
```bash
docker build -t smartassist-backend .
```

### Run Container
```bash
docker run -p 5000:5000 \
  -e MONGODB_URI=mongodb://mongo:27017/smartassist \
  -e GEMINI_API_KEY=your_key \
  smartassist-backend
```

## Render Deployment

Use the included `render.yaml` for a one-click web service setup, or create a Node web service manually with:

- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`

Required env vars on Render:

- `MONGODB_URI`
- `NODE_ENV=production`

Optional env vars:

- `CORS_ORIGIN`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `GROQ_API_KEY_2`
- `OPENAI_API_KEY`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

### Using Docker Compose
```bash
docker-compose up -d
```

## Scaling Considerations

1. **Database**: Use MongoDB Atlas for production
2. **Caching**: Add Redis for frequently accessed plans
3. **Queue**: Use Bull/RabbitMQ for long-running tasks
4. **CDN**: Cache static task templates
5. **Load Balancing**: Use PM2 or Kubernetes

## Adding Custom Tasks

Edit `taskPlanService.js`:

```javascript
const plans = {
  'your-task': {
    appPackageName: 'com.example.app',
    steps: [
      { stepIndex: 0, instruction: 'Step 1', actionType: 'tap' },
      { stepIndex: 1, instruction: 'Step 2', actionType: 'input' }
    ],
    estimatedDuration: 120
  }
};
```

## Monitoring

### Logs
```bash
npm run dev  # Shows all logs
```

### MongoDB
```bash
mongosh localhost:27017
use smartassist
db.tasks.find()
```

### Health Check
```bash
curl http://localhost:5000/api/health
```

## Troubleshooting

### MongoDB Connection Error
```
Solution: Ensure MongoDB is running
mongod
```

### API Key Invalid
```
Solution: Update .env with correct keys
Verify at provider's console
```

### Ollama Not Responding
```
Solution: Start Ollama
ollama serve
```

### CORS Errors
```
Solution: Add your domain to CORS_ORIGIN in .env
```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use MongoDB Atlas (not local)
- [ ] Enable API authentication
- [ ] Setup rate limiting
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Setup logging & monitoring
- [ ] Enable HTTPS
- [ ] Test API endpoints
- [ ] Setup CI/CD pipeline
