# JUS'TAPP Adaptive AI API Handoff

Base URL:

```text
https://jus-tapp-server.onrender.com
```

Local URL:

```text
http://localhost:5000
```

Auth is recommended for the expo and user personalization. Existing APIs still accept `userId` directly so Android integration can be gradual.

## Android Integration Order

1. Create or login user.
2. Create adaptive task plan.
3. Start session.
4. Send Accessibility Service interaction events.
5. Request adaptive guidance after events or before each step.
6. Render overlay using the guidance response.
7. Mark step completed.
8. Read analytics for demo dashboards and model learning proof.

## 1. Create Demo User

Use this for expo testing without email/password.

```http
POST /api/v1/auth/demo
```

Request:

```json
{
  "name": "Teacher Demo Elderly User",
  "userCategory": "elderly"
}
```

Response:

```json
{
  "token": "jwt_token_here",
  "user": {
    "userId": "user_18ab42c1",
    "name": "Teacher Demo Elderly User",
    "role": "demo",
    "userCategory": "elderly",
    "accessibilityProfile": {
      "language": "en",
      "voiceGuidance": true,
      "largeText": true,
      "slowMode": true,
      "preferredInstructionStyle": "adaptive"
    }
  }
}
```

Android usage:

```text
Store token in encrypted storage.
Use user.userId in all task/session calls.
Send Authorization: Bearer <token> for protected profile APIs.
```

## 2. Register User

```http
POST /api/v1/auth/register
```

Request:

```json
{
  "name": "Ramesh",
  "email": "ramesh@example.com",
  "password": "12345678",
  "userCategory": "first_time",
  "accessibilityProfile": {
    "language": "en",
    "voiceGuidance": true,
    "largeText": true,
    "slowMode": true
  }
}
```

Response is same shape as demo user.

## 3. Login User

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "ramesh@example.com",
  "password": "12345678"
}
```

Response:

```json
{
  "token": "jwt_token_here",
  "user": {
    "userId": "user_18ab42c1",
    "name": "Ramesh",
    "email": "ramesh@example.com",
    "role": "user",
    "userCategory": "first_time"
  }
}
```

## 4. Create Adaptive Task Plan

Use this as the main task creation API for the AI model demo.

```http
POST /api/v1/task/plan/adaptive
```

Request:

```json
{
  "taskDescription": "Book a cab to Rajouri Garden",
  "userId": "user_18ab42c1",
  "language": "en",
  "confusionLevel": "high_assistance_needed",
  "userCategory": "elderly",
  "currentScreen": "Android launcher",
  "recentBehavior": {
    "repeatedTaps": 3,
    "incorrectTaps": 2,
    "inactivityMs": 9000,
    "overlayRequestCount": 4,
    "gestureAccuracy": 0.55
  }
}
```

Response:

```json
{
  "success": true,
  "adaptive": true,
  "confusionLevel": "high_assistance_needed",
  "guidanceTier": "detailed",
  "plan": {
    "taskId": "task_a71c9f02",
    "mongoId": "6a0466a59f01497c23a88b33",
    "description": "Book a cab to Rajouri Garden",
    "appPackageName": "com.ubercab",
    "estimatedDuration": 180,
    "steps": [
      {
        "stepIndex": 0,
        "instruction": "Tap the Uber icon on the home screen",
        "targetElement": "Uber",
        "matchText": "Uber",
        "actionType": "openApp",
        "status": "pending"
      }
    ]
  }
}
```

Android usage:

```text
Use plan.taskId for session creation.
Use appPackageName to open or validate the target app.
Use steps for initial overlay sequence.
```

## 5. Create Normal Task Plan

Use this for baseline comparison against adaptive behavior.

```http
POST /api/v1/task/plan
```

Request:

```json
{
  "taskDescription": "Book a cab to Rajouri Garden",
  "userId": "user_18ab42c1",
  "language": "en"
}
```

Response:

```json
{
  "success": true,
  "plan": {
    "taskId": "task_4b19cd88",
    "mongoId": "6a0466a59f01497c23a88b33",
    "description": "Book a cab to Rajouri Garden",
    "appPackageName": "com.ubercab",
    "steps": [],
    "estimatedDuration": 120
  }
}
```

## 6. Start Session

```http
POST /api/v1/session
```

Request:

```json
{
  "userId": "user_18ab42c1",
  "taskId": "task_a71c9f02",
  "deviceInfo": {
    "platform": "android",
    "appVersion": "1.0.0",
    "deviceModel": "Samsung S23",
    "osVersion": "14"
  }
}
```

Response:

```json
{
  "sessionId": "session_72cc91aa",
  "mongoId": "6a0467e29f01497c23a88b54",
  "userId": "user_18ab42c1",
  "status": "active",
  "currentStepIndex": 0,
  "confusionLevel": "independent_user",
  "confusionScore": 0,
  "guidanceTier": "minimal",
  "totalSteps": 7
}
```

Android usage:

```text
Store sessionId for the active task.
Every event and guidance request should include this sessionId.
```

## 7. Send One Interaction Event

```http
POST /api/v1/session/{sessionId}/event
```

Request:

```json
{
  "userId": "user_18ab42c1",
  "stepIndex": 1,
  "eventType": "incorrect_tap",
  "value": 1,
  "durationMs": 0,
  "screenName": "Uber Home",
  "targetText": "Profile",
  "targetElement": "Profile icon",
  "expectedElement": "Where to?",
  "metadata": {
    "x": 512,
    "y": 940
  }
}
```

Response:

```json
{
  "success": true,
  "eventId": "6a046d23b694dc164614d8c9",
  "sessionId": "session_72cc91aa",
  "taskId": "task_a71c9f02",
  "eventType": "incorrect_tap",
  "createdAt": "2026-05-13T12:22:59.000Z"
}
```

Supported event types:

```text
tap
incorrect_tap
repeated_tap
back
gesture
inactivity
navigation_retry
overlay_request
hesitation
wrong_screen
same_screen_loop
voice_help
step_started
step_completed
```

Android usage:

```text
Send tap after normal click.
Send incorrect_tap if clicked element does not match expectedElement.
Send repeated_tap when same coordinates or same element are tapped repeatedly.
Send inactivity with durationMs when no useful action happens.
Send hesitation with durationMs before action after overlay appears.
Send wrong_screen when Accessibility root package/screen does not match expected app screen.
Send gesture with value between 0 and 1 for gesture accuracy.
```

## 8. Send Batch Events

```http
POST /api/v1/adaptive/events/batch
```

Request:

```json
{
  "events": [
    {
      "sessionId": "session_72cc91aa",
      "userId": "user_18ab42c1",
      "stepIndex": 1,
      "eventType": "repeated_tap",
      "value": 1
    },
    {
      "sessionId": "session_72cc91aa",
      "userId": "user_18ab42c1",
      "stepIndex": 1,
      "eventType": "overlay_request",
      "value": 1
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "count": 2,
  "eventIds": [
    "6a046d23b694dc164614d8c9",
    "6a046d23b694dc164614d8ca"
  ]
}
```

## 9. Predict Confusion

```http
POST /api/v1/adaptive/predict
```

Request from stored events:

```json
{
  "sessionId": "session_72cc91aa",
  "userId": "user_18ab42c1",
  "stepIndex": 1
}
```

Direct feature request:

```json
{
  "userId": "user_18ab42c1",
  "features": {
    "repeatedTaps": 3,
    "incorrectTaps": 2,
    "inactivityMs": 9000,
    "navigationRetries": 1,
    "backButtonCount": 2,
    "gestureAccuracy": 0.55,
    "overlayRequestCount": 3,
    "hesitationMs": 5000,
    "wrongScreenCount": 1
  }
}
```

Response:

```json
{
  "success": true,
  "prediction": {
    "predictionId": "6a046d23b694dc164614d8c9",
    "level": "critical_guidance_required",
    "score": 100,
    "confidence": 0.96,
    "guidanceTier": "critical",
    "features": {},
    "reasons": [
      "Repeated taps detected",
      "Incorrect taps detected",
      "Long inactivity or hesitation"
    ]
  }
}
```

Android usage:

```text
Call this when you want only the ML decision.
For normal flow, call guidance endpoint because it predicts and adapts in one request.
```

## 10. Get Adaptive Guidance

Preferred endpoint:

```http
POST /api/v1/session/{sessionId}/guidance
```

Generic endpoint:

```http
POST /api/v1/guidance/adapt
```

Request:

```json
{
  "userId": "user_18ab42c1",
  "stepIndex": 1
}
```

Testing request:

```json
{
  "userId": "user_18ab42c1",
  "stepIndex": 1,
  "forceConfusionLevel": "critical_guidance_required"
}
```

Response:

```json
{
  "success": true,
  "guidance": {
    "guidanceId": "guidance_ed92c0ce",
    "taskId": "task_a71c9f02",
    "mongoTaskId": "6a0466a59f01497c23a88b33",
    "sessionId": "session_72cc91aa",
    "stepIndex": 1,
    "confusionLevel": "high_assistance_needed",
    "confidence": 0.91,
    "score": 61,
    "guidanceTier": "detailed",
    "overlayMode": "enhanced_visual",
    "reasons": [
      "Incorrect taps detected",
      "Frequent overlay help requests"
    ],
    "step": {
      "stepIndex": 1,
      "instruction": "Look carefully at the screen. Tap the white box at the top that says \"Where to?\". Use the visible text or icon labeled \"Where to?\" as your target.",
      "shortInstruction": "Tap \"Where to?\" field",
      "actionType": "tap",
      "targetElement": "Where to?",
      "matchText": "Where to?",
      "targetAppPackage": "com.ubercab",
      "highlightText": "Where to?",
      "voiceHint": "Tap Where to?.",
      "detailLevel": "detailed",
      "confusionLevel": "high_assistance_needed",
      "confidence": 0.91,
      "visualHints": {
        "emphasizeTarget": true,
        "pulseTarget": true,
        "dimBackground": false,
        "slowMode": false
      }
    }
  }
}
```

Android usage:

```text
Render guidance.step.instruction as overlay text.
Use guidance.step.highlightText to match AccessibilityNodeInfo text/contentDescription.
Use visualHints.pulseTarget to animate highlight.
Use visualHints.dimBackground to dim non-target content.
Use visualHints.slowMode to slow step transitions.
Use voiceHint for TextToSpeech.
Use overlayMode to choose overlay behavior.
```

Overlay modes:

```text
minimal: simple text
guided: text plus target highlight
enhanced_visual: target pulse plus voice hint
voice_visual_slow: slow pacing, dim background, large highlight, voice hint
```

## 11. Get Session State

```http
GET /api/v1/session/{sessionId}/state
```

Response:

```json
{
  "success": true,
  "session": {
    "sessionId": "session_72cc91aa",
    "mongoId": "6a0467e29f01497c23a88b54",
    "userId": "user_18ab42c1",
    "taskId": "task_a71c9f02",
    "status": "active",
    "currentStepIndex": 1,
    "confusionLevel": "high_assistance_needed",
    "confusionScore": 61,
    "guidanceTier": "detailed",
    "progress": 25
  },
  "latestPrediction": {},
  "latestGuidance": {},
  "recentEvents": []
}
```

## 12. Update Task Step

```http
PUT /api/v1/task/{taskId}/step/{stepIndex}
```

Request:

```json
{
  "status": "completed"
}
```

Response:

```json
{
  "taskId": "task_a71c9f02",
  "mongoId": "6a0466a59f01497c23a88b33",
  "currentStepIndex": 2,
  "status": "executing",
  "steps": []
}
```

## 13. User Analytics

Use this for expo dashboard and to show the model learning per user.

```http
GET /api/v1/analytics/user/{userId}
```

Response:

```json
{
  "success": true,
  "analytics": {
    "userId": "user_18ab42c1",
    "totals": {
      "tasks": 4,
      "sessions": 4,
      "events": 122,
      "predictions": 34,
      "guidanceVersions": 28
    },
    "assistanceDistribution": {
      "independent_user": 8,
      "moderate_assistance_needed": 10,
      "high_assistance_needed": 12,
      "critical_guidance_required": 4
    },
    "eventDistribution": {
      "tap": 60,
      "incorrect_tap": 12,
      "overlay_request": 18
    },
    "learningSignal": {
      "baselineConfusion": 64,
      "latestConfusion": 38,
      "confusionDelta": -26,
      "adaptationActive": true
    }
  }
}
```

## 14. System Analytics

```http
GET /api/v1/analytics/system
```

Response:

```json
{
  "success": true,
  "analytics": {
    "totals": {
      "sessions": 40,
      "predictions": 400,
      "guidanceVersions": 350,
      "events": 1200
    },
    "averageConfusionScore": 44,
    "activeSessions": 7,
    "assistanceDistribution": {},
    "featureImportance": []
  }
}
```

## 15. Feature Importance

```http
GET /api/v1/analytics/feature-importance
```

Response:

```json
{
  "success": true,
  "featureImportance": [
    {
      "feature": "incorrectTaps",
      "importance": 25,
      "normalizedImportance": 1
    },
    {
      "feature": "wrongScreenCount",
      "importance": 24,
      "normalizedImportance": 0.96
    }
  ]
}
```

## Confusion Levels

```text
independent_user: user is moving confidently
moderate_assistance_needed: user needs clearer but still compact guidance
high_assistance_needed: user needs detailed visual guidance and exact labels
critical_guidance_required: user needs slow pacing, large highlights, voice and micro-steps
```

## What To Implement In Kotlin

Accessibility Service should detect:

```text
Current app package
Current screen text
Clicked node text/contentDescription
Expected target text from backend
Wrong screen navigation
Back button usage
Repeated taps
Time from instruction shown to first action
Time without meaningful action
Gesture accuracy if gesture guidance is active
Overlay help button taps
```

Overlay should consume:

```text
instruction
highlightText
voiceHint
visualHints.emphasizeTarget
visualHints.pulseTarget
visualHints.dimBackground
visualHints.slowMode
overlayMode
```

Recommended loop:

```text
On task start: plan/adaptive -> session
Before each step: session/{id}/guidance
During each step: send events
After confusion spike: session/{id}/guidance again
After correct action: task/{taskId}/step/{stepIndex}
On expo dashboard: analytics/user/{userId}
```
