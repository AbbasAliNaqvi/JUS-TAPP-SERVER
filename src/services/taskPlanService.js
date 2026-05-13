import axios from 'axios';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

/**
 * Service for generating task plans using Cloud LLMs
 * Supports Gemini, Groq, OpenAI, and local Ollama
 */

export class TaskPlanService {

  // Key rotation tracking
  static groqKeyIndex = 0;
  static groqKeys = [];

  // Initialize available Groq keys
  static initializeGroqKeys() {
    const keys = [];
    if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
    if (process.env.GROQ_API_KEY_2) keys.push(process.env.GROQ_API_KEY_2);
    this.groqKeys = keys;
    console.log(`[TaskPlanService] Initialized with ${keys.length} Groq API key(s)`);
  }

  // Get next Groq API key (with rotation)
  static getNextGroqKey() {
    if (this.groqKeys.length === 0) {
      this.initializeGroqKeys();
    }
    if (this.groqKeys.length === 0) {
      throw new Error('No GROQ_API_KEY configured');
    }
    const key = this.groqKeys[this.groqKeyIndex];
    this.groqKeyIndex = (this.groqKeyIndex + 1) % this.groqKeys.length;
    return key;
  }

  static async generatePlanWithGemini(taskDescription, userId, language = 'en') {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const prompt = this.buildTaskPrompt(taskDescription, language);

      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        {
          headers: { 'x-goog-api-key': apiKey }
        }
      );

      return this.parseTaskPlan(response.data, taskDescription);
    } catch (error) {
      console.error('Gemini API error:', error.message);
      throw error;
    }
  }

  static async generatePlanWithGroq(taskDescription, userId, language = 'en') {
    try {
      const apiKey = this.getNextGroqKey();
      const prompt = this.buildTaskPrompt(taskDescription, language);

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.1-8b-instant',
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: 1024
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`[TaskPlanService] Groq request successful (Key #${this.groqKeyIndex})`);
      return this.parseTaskPlan(response.data.choices[0].message.content, taskDescription);
    } catch (error) {
      console.error('Groq API error:', error.message);
      throw error;
    }
  }

  static async generateAdaptiveTaskPlan(taskDescription, userId, {
    language = 'en',
    confusionLevel = 'independent_user',
    userCategory = 'moderate',
    currentScreen = '',
    recentBehavior = {}
  } = {}) {
    const prompt = this.buildAdaptiveTaskPrompt(taskDescription, {
      language,
      confusionLevel,
      userCategory,
      currentScreen,
      recentBehavior
    });

    if (process.env.GROQ_API_KEY) {
      try {
        const apiKey = this.getNextGroqKey();
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1400,
            temperature: 0.25
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return this.parseTaskPlan(response.data.choices[0].message.content, taskDescription);
      } catch (error) {
        console.warn('Adaptive Groq generation failed:', error.message);
      }
    }

    return this.expandPlanForAssistanceLevel(
      this.generateFallbackPlan(taskDescription),
      confusionLevel
    );
  }

  static buildAdaptiveTaskPrompt(taskDescription, {
    language = 'en',
    confusionLevel = 'independent_user',
    userCategory = 'moderate',
    currentScreen = '',
    recentBehavior = {}
  } = {}) {
    const detailRules = {
      independent_user: 'Use short concise steps. Avoid extra explanation.',
      moderate_assistance_needed: 'Use simple language and include one visible target per step.',
      high_assistance_needed: 'Use detailed screen landmarks, exact labels, and clear waiting instructions.',
      critical_guidance_required: 'Use micro-steps, slow pacing, voice-friendly wording, large highlight targets, and contextual explanations.'
    };

    return `
You are the adaptive guidance intelligence for JUS TAPP, an Android Accessibility Service overlay assistant.

Task: "${taskDescription}"
Language: ${language}
User category: ${userCategory}
Predicted confusion level: ${confusionLevel}
Current screen: ${currentScreen || 'unknown'}
Recent behavior metrics: ${JSON.stringify(recentBehavior)}

Instruction policy:
${detailRules[confusionLevel] || detailRules.independent_user}

Return ONLY valid JSON:
{
  "appPackageName": "android.package.name",
  "steps": [
    {
      "stepIndex": 0,
      "instruction": "elderly-friendly instruction",
      "actionType": "tap",
      "targetElement": "visible UI element",
      "matchText": "exact visible text or accessibility label"
    }
  ],
  "estimatedDuration": 60
}

Allowed actionType values: tap, swipe, input, scroll, openApp, long-press, double-tap, drag, wait, voice-input.
Every step must have targetElement and matchText.
For critical users, split complex actions into smaller steps.
    `;
  }

  static expandPlanForAssistanceLevel(plan, confusionLevel) {
    if (!['high_assistance_needed', 'critical_guidance_required'].includes(confusionLevel)) {
      return plan;
    }

    const expandedSteps = [];
    for (const step of plan.steps || []) {
      if (confusionLevel === 'critical_guidance_required' && step.actionType !== 'wait') {
        expandedSteps.push({
          ...step,
          stepIndex: expandedSteps.length,
          instruction: `Look for "${step.matchText || step.targetElement}".`
        });
      }
      expandedSteps.push({
        ...step,
        stepIndex: expandedSteps.length,
        instruction: confusionLevel === 'critical_guidance_required'
          ? `Slowly ${step.instruction}. Wait after this action.`
          : `${step.instruction}. Use the visible label "${step.matchText || step.targetElement}".`
      });
    }

    return {
      ...plan,
      steps: expandedSteps,
      estimatedDuration: Math.round((plan.estimatedDuration || 60) * (confusionLevel === 'critical_guidance_required' ? 1.8 : 1.35))
    };
  }

  static async generatePlanWithOllama(taskDescription, userId, language = 'en') {
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api';
      const model = process.env.OLLAMA_MODEL || 'llama2';
      
      const prompt = this.buildTaskPrompt(taskDescription, language);

      const response = await axios.post(
        `${ollamaUrl}/generate`,
        {
          model,
          prompt,
          stream: false
        }
      );

      return this.parseTaskPlan(response.data.response, taskDescription);
    } catch (error) {
      console.error('Ollama API error:', error.message);
      // Return fallback plan if Ollama fails
      return this.generateFallbackPlan(taskDescription);
    }
  }

  static buildTaskPrompt(taskDescription, language = 'en') {
    return `
You are an expert Android accessibility assistant. Generate a step-by-step task execution plan.

Task: "${taskDescription}"
Language: ${language}

Respond with a JSON object containing:
{
  "appPackageName": "package.name",
  "steps": [
    {
      "stepIndex": 0,
      "instruction": "Clear instruction in ${language}",
      "actionType": "tap",
      "targetElement": "Element description",
      "matchText": "Exact visible label or content description to match"
    }
  ],
  "estimatedDuration": 60
}

IMPORTANT: Only use these exact actionType values:
- "tap" (single tap on element)
- "swipe" (swipe in a direction)
- "input" (type text)
- "scroll" (scroll up/down)
- "openApp" (open an application)
- "long-press" (long press on element)
- "double-tap" (double tap)
- "drag" (drag element)
- "wait" (wait for element)
- "voice-input" (voice command)

Be specific about:
- Which app to open
- Exact UI elements to interact with
- Input values needed
- Navigation steps

PLANNING PRIORITY:
- Always use the app explicitly mentioned by the user. If no app is named, infer the most likely app from the task.
- Set "appPackageName" to the correct Android package for the chosen app.
- If the task is messaging-related and no app is named, choose the most common messaging app on the device.

CRITICAL TARGETING RULES:
- Every step must include a useful "targetElement" value.
- For app-opening steps, targetElement must be the app name visible on the launcher, such as "WhatsApp", "Uber", "YouTube", or "Maps".
- For icon-only controls, targetElement must describe the visible accessibility label or content description, such as "Search", "New chat", "Send", or "Back".
- Do not use vague targets like "button", "next", "continue", or "message area".
- Keep instruction text short, elderly-friendly, and directly actionable.
- Every step must include "matchText" with the exact on-screen text or accessibility label that should be matched for highlighting and completion.

Return ONLY valid JSON. No markdown, no explanations.
    `;
  }

  static parseTaskPlan(responseData, taskDescription) {
    try {
      const text = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
      
      // Handle escaped quotes and newlines in JSON
      let cleanText = text.replace(/\\"/g, '"').replace(/\\n/g, '\n');
      
      // Extract JSON object
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No JSON found in response, using fallback');
        return this.generateFallbackPlan(taskDescription);
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        // Try to clean up common JSON issues
        let sanitized = jsonMatch[0]
          .replace(/,\s*\}/g, '}')  // Remove trailing commas
          .replace(/,\s*\]/g, ']')  // Remove trailing commas in arrays
          .replace(/:\s*undefined/g, ':null');  // Replace undefined with null
        parsed = JSON.parse(sanitized);
      }

      // Normalize action types
      const actionTypeMap = {
        tap: 'tap',
        swipe: 'swipe',
        input: 'input',
        scroll: 'scroll',
        openapp: 'openApp',
        'open-app': 'openApp',
        longpress: 'long-press',
        'long-press': 'long-press',
        doubletap: 'double-tap',
        'double-tap': 'double-tap',
        drag: 'drag',
        wait: 'wait',
        voiceinput: 'voice-input',
        'voice-input': 'voice-input'
      };
      
      const normalizedDescription = taskDescription.toLowerCase();
      const explicitApp = this.findExplicitApp(normalizedDescription);
      const inferredPackageName = explicitApp?.packageName || this.inferPrimaryPackage(
        parsed.appPackageName,
        normalizedDescription
      );
      const inferredAppName = explicitApp?.appName || this.inferAppName(
        parsed.appPackageName,
        normalizedDescription
      );
      const contactName = this.extractContactName(taskDescription);

      return {
        taskId: uuidv4(),
        description: taskDescription,
        appPackageName: inferredPackageName,
        steps: this.applyContactHints(
          this.applyAppHints(
            (parsed.steps || []).map((step, idx) => {
          // Normalize action type
          let actionType = (step.actionType || 'tap').toString().trim().toLowerCase();
          
          // Handle compound actions like "scroll|tap" -> pick first one
          if (actionType.includes('|')) {
            actionType = actionType.split('|')[0].trim();
          }
          
          // Ensure it's a valid enum value
          actionType = actionTypeMap[actionType] || 'tap';

          const fallbackText = (step.targetElement || step.instruction || '').toString().trim();
          const matchText = this.buildMatchText(step, fallbackText);
          
          return {
            stepIndex: idx,
            instruction: step.instruction || 'Perform action',
            actionType,
            targetElement: step.targetElement || '',
            matchText,
            targetAppPackage: step.targetAppPackage || inferredPackageName
          };
            }),
            inferredAppName,
            inferredPackageName
          ),
          contactName
        ),
        estimatedDuration: parsed.estimatedDuration || 120
      };
    } catch (error) {
      console.error('Error parsing task plan:', error.message);
      return this.generateFallbackPlan(taskDescription);
    }
  }

  static generateFallbackPlan(taskDescription) {
    // Fallback plan for common tasks
    const normalizedDescription = taskDescription.toLowerCase();
    const explicitApp = this.findExplicitApp(normalizedDescription);
    const inferredPackageName = explicitApp?.packageName || this.inferPrimaryPackage('', normalizedDescription);
    const inferredAppName = explicitApp?.appName || this.inferAppName('', normalizedDescription);
    const contactName = this.extractContactName(taskDescription);
    const enrichSteps = (steps, appPackageName) => {
      return steps.map((step, idx) => {
        const rawTarget = step.targetElement || step.instruction || '';
        const cleanedTarget = rawTarget
          .replace(/\b(open|tap|press|click|select|choose|type|enter|launch|now|please|the|a|an|to|on|and|then)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const matchText = this.buildMatchText(step, cleanedTarget);

        return {
          stepIndex: step.stepIndex ?? idx,
          instruction: step.instruction || 'Perform action',
            actionType: this.normalizeActionType(step.actionType || 'tap'),
          targetElement: step.targetElement || cleanedTarget,
          matchText,
          targetAppPackage: step.targetAppPackage || appPackageName
        };
      });
    };

    const plans = {
      'uber': {
        appPackageName: 'com.ubercab',
        steps: [
          { stepIndex: 0, instruction: 'Open Uber app', actionType: 'openApp', targetElement: 'Uber' },
          { stepIndex: 1, instruction: 'Tap "Where to?" field', actionType: 'tap', targetElement: 'Where to?' },
          { stepIndex: 2, instruction: 'Enter destination', actionType: 'input', targetElement: 'Where to?' },
          { stepIndex: 3, instruction: 'Select ride type', actionType: 'tap', targetElement: 'UberX' },
          { stepIndex: 4, instruction: 'Confirm booking', actionType: 'tap', targetElement: 'Confirm' }
        ],
        estimatedDuration: 180
      },
      'rapido': {
        appPackageName: 'com.rapido.passenger',
        steps: [
          { stepIndex: 0, instruction: 'Open Rapido', actionType: 'openApp', targetElement: 'Rapido' },
          { stepIndex: 1, instruction: 'Select bike ride', actionType: 'tap', targetElement: 'Bike' },
          { stepIndex: 2, instruction: 'Confirm pickup location', actionType: 'tap', targetElement: 'Pickup' },
          { stepIndex: 3, instruction: 'Enter drop location', actionType: 'tap', targetElement: 'Drop' },
          { stepIndex: 4, instruction: 'Book the ride', actionType: 'tap', targetElement: 'Book' }
        ],
        estimatedDuration: 180
      },
      'whatsapp': {
        appPackageName: 'com.whatsapp',
        steps: [
          { stepIndex: 0, instruction: 'Open WhatsApp', actionType: 'openApp', targetElement: 'WhatsApp' },
          { stepIndex: 1, instruction: 'Search contact', actionType: 'tap', targetElement: 'Search' },
          { stepIndex: 2, instruction: 'Select contact', actionType: 'tap', targetElement: contactName || 'Contact', matchText: contactName || undefined },
          { stepIndex: 3, instruction: 'Type message', actionType: 'input', targetElement: 'Message' },
          { stepIndex: 4, instruction: 'Send message', actionType: 'tap', targetElement: 'Send' }
        ],
        estimatedDuration: 120
      }
    };

    const desc = taskDescription.toLowerCase();
    for (const [key, plan] of Object.entries(plans)) {
      if (desc.includes(key)) {
        return {
          taskId: uuidv4(),
          description: taskDescription,
          appPackageName: plan.appPackageName,
          steps: enrichSteps(plan.steps, plan.appPackageName),
          estimatedDuration: plan.estimatedDuration
        };
      }
    }

    // Generic fallback
    return {
      taskId: uuidv4(),
      description: taskDescription,
      appPackageName: inferredPackageName,
      steps: enrichSteps(
        [
          {
            stepIndex: 0,
            instruction: inferredAppName ? `Open ${inferredAppName}` : 'Open the app',
            actionType: 'openApp',
            targetElement: inferredAppName || 'App',
            targetAppPackage: inferredPackageName || undefined
          },
          {
            stepIndex: 1,
            instruction: taskDescription,
            actionType: 'tap',
            targetElement: contactName || 'Next',
            targetAppPackage: inferredPackageName || undefined
          }
        ],
        inferredPackageName || ''
      ),
      estimatedDuration: 60
    };
  }

  static normalizeActionType(actionType = 'tap') {
    const normalized = actionType.toString().trim().toLowerCase();
    const actionTypeMap = {
      tap: 'tap',
      swipe: 'swipe',
      input: 'input',
      scroll: 'scroll',
      openapp: 'openApp',
      'open-app': 'openApp',
      longpress: 'long-press',
      'long-press': 'long-press',
      doubletap: 'double-tap',
      'double-tap': 'double-tap',
      drag: 'drag',
      wait: 'wait',
      voiceinput: 'voice-input',
      'voice-input': 'voice-input'
    };

    return actionTypeMap[normalized] || 'tap';
  }

  static inferPrimaryPackage(parsedPackageName, normalizedDescription) {
    if (parsedPackageName && parsedPackageName.trim()) {
      return parsedPackageName.trim();
    }

    const explicit = this.findExplicitApp(normalizedDescription);
    if (explicit) return explicit.packageName;

    const implicit = this.findImplicitApp(normalizedDescription);
    return implicit ? implicit.packageName : '';
  }

  static inferAppName(parsedPackageName, normalizedDescription) {
    if (parsedPackageName && parsedPackageName.trim()) {
      const entry = this.appCatalog().find(item => item.packageName === parsedPackageName.trim());
      if (entry) return entry.appName;
      const lastSegment = parsedPackageName.split('.').pop();
      return lastSegment ? lastSegment.replace(/^./, char => char.toUpperCase()) : '';
    }

    const explicit = this.findExplicitApp(normalizedDescription);
    if (explicit) return explicit.appName;

    const implicit = this.findImplicitApp(normalizedDescription);
    return implicit ? implicit.appName : '';
  }

  static appCatalog() {
    return [
      {
        explicitKeywords: ['rapido'],
        implicitKeywords: ['bike ride', 'bike taxi'],
        packageName: 'com.rapido.passenger',
        appName: 'Rapido'
      },
      {
        explicitKeywords: ['uber'],
        implicitKeywords: ['cab', 'taxi', 'ride'],
        packageName: 'com.ubercab',
        appName: 'Uber'
      },
      {
        explicitKeywords: ['ola'],
        implicitKeywords: ['ola cab', 'ola taxi'],
        packageName: 'com.olacabs.customer',
        appName: 'Ola'
      },
      {
        explicitKeywords: ['whatsapp'],
        implicitKeywords: ['message', 'chat', 'send', 'reply', 'forward', 'status', 'update'],
        packageName: 'com.whatsapp',
        appName: 'WhatsApp'
      },
      {
        explicitKeywords: ['youtube'],
        implicitKeywords: ['video', 'watch'],
        packageName: 'com.google.android.youtube',
        appName: 'YouTube'
      },
      {
        explicitKeywords: ['maps', 'google maps'],
        implicitKeywords: ['navigate', 'location', 'directions'],
        packageName: 'com.google.android.apps.maps',
        appName: 'Maps'
      },
      {
        explicitKeywords: ['gmail'],
        implicitKeywords: ['email', 'mail'],
        packageName: 'com.google.android.gm',
        appName: 'Gmail'
      }
    ];
  }

  static findExplicitApp(normalizedDescription) {
    return this.appCatalog().find(item =>
      item.explicitKeywords.some(keyword => normalizedDescription.includes(keyword))
    );
  }

  static findImplicitApp(normalizedDescription) {
    return this.appCatalog().find(item =>
      item.implicitKeywords.some(keyword => normalizedDescription.includes(keyword))
    );
  }

  static extractContactName(taskDescription) {
    if (!taskDescription) return '';
    const match = taskDescription.match(/\bto\s+([A-Za-z0-9 ._-]{2,40})(?:\s+on|\s+in|\s+via|$)/i);
    if (!match) return '';
    return match[1].trim();
  }

  static applyContactHints(steps, contactName) {
    if (!contactName) return steps;
    let applied = false;
    return steps.map(step => {
      if (applied) return step;
      if (step.actionType !== 'tap') return step;

      const target = (step.targetElement || '').toLowerCase();
      const instruction = (step.instruction || '').toLowerCase();
      const matchText = (step.matchText || '').toLowerCase();

      const isSearchStep = target.includes('search') || instruction.includes('search');
      const isContactStep =
        target.includes('contact') ||
        target.includes('recipient') ||
        target.includes('chat') ||
        instruction.includes('select') ||
        instruction.includes('choose') ||
        instruction.includes('open chat');

      if (isSearchStep || !isContactStep) return step;
      if (matchText.includes(contactName.toLowerCase())) return step;

      applied = true;
      return {
        ...step,
        targetElement: contactName,
        matchText: contactName
      };
    });
  }

  static applyAppHints(steps, appName, appPackageName) {
    if (!appName) return steps;
    let applied = false;

    return steps.map(step => {
      if (applied) return step;

      const instruction = (step.instruction || '').toLowerCase();
      const actionType = (step.actionType || '').toLowerCase();
      const target = (step.targetElement || '').toLowerCase();
      const shouldInject =
        actionType === 'openapp' ||
        instruction.includes('open ') ||
        instruction.includes('launch ');

      if (!shouldInject) return step;
      if (target.includes(appName.toLowerCase())) return step;

      applied = true;
      return {
        ...step,
        targetElement: appName,
        matchText: appName,
        targetAppPackage: appPackageName || step.targetAppPackage
      };
    });
  }

  static buildMatchText(step, fallbackText) {
    const direct = (step.matchText || '').toString().trim();
    if (direct) {
      const sanitized = this.sanitizeMatchText(direct);
      if (sanitized && !this.isGenericLabel(sanitized)) return sanitized;
    }

    const target = (step.targetElement || '').toString().trim();
    if (target) {
      const sanitized = this.sanitizeMatchText(target);
      if (sanitized && !this.isGenericLabel(sanitized)) return sanitized;
    }

    const instruction = (step.instruction || '').toString().trim();
    const quoted = this.extractQuotedText(instruction);
    if (quoted) {
      const sanitized = this.sanitizeMatchText(quoted);
      if (sanitized && !this.isGenericLabel(sanitized)) return sanitized;
    }

    const fallback = this.sanitizeMatchText(fallbackText || instruction);
    if (fallback && !this.isGenericLabel(fallback)) return fallback;

    return this.inferMatchTextFromInstruction(instruction);
  }

  static extractQuotedText(text) {
    if (!text) return '';
    const match = text.match(/"([^"]{1,80})"/);
    return match ? match[1].trim() : '';
  }

  static sanitizeMatchText(text) {
    if (!text) return '';
    const cleaned = text
      .replace(/\b(tap|press|click|select|choose|open|launch|type|enter|now|please|the|a|an|to|on|and|then)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length <= 48) return cleaned;
    return cleaned.split(' ').slice(0, 4).join(' ');
  }

  static isGenericLabel(text) {
    if (!text) return true;
    const value = text.toLowerCase();
    const generic = [
      'next',
      'continue',
      'ok',
      'done',
      'app',
      'screen',
      'menu',
      'option',
      'start',
      'proceed',
      'back'
    ];
    return generic.includes(value);
  }

  static inferMatchTextFromInstruction(instruction) {
    if (!instruction) return '';
    const text = instruction.toLowerCase();

    if (text.includes('search')) return 'Search';
    if (text.includes('add to cart') || text.includes('add item')) return 'Add to cart';
    if (text.includes('add')) return 'Add';
    if (text.includes('cart') || text.includes('basket')) return 'Cart';
    if (text.includes('checkout')) return 'Checkout';
    if (text.includes('place order') || text.includes('order')) return 'Place order';
    if (text.includes('pay') || text.includes('payment')) return 'Pay';
    if (text.includes('restaurant')) return 'Restaurant';
    if (text.includes('pickup')) return 'Pickup';
    if (text.includes('drop') || text.includes('destination')) return 'Drop';
    if (text.includes('location')) return 'Location';
    if (text.includes('confirm')) return 'Confirm';
    if (text.includes('allow')) return 'Allow';
    if (text.includes('send')) return 'Send';

    return '';
  }
}

export default TaskPlanService;
