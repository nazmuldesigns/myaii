import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import database from './database.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// Configuration
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Demo Mode
const DEMO_MODE = process.env.DEMO_MODE !== 'false';

function buildDemoReply({ message, hasImage, username }) {
  const lines = [];
  lines.push(`Hello ${username}, you are chatting with me in Demo Mode.`);
  lines.push('');
  lines.push('No real AI provider is configured, so this is a pre-built demo reply instead of a live model response.');
  lines.push('');
  if (hasImage) {
    lines.push('I can see you attached an image. Real providers (Claude/OpenAI/Gemini) support vision inputs too, so once a valid API key is set I will be able to analyze it.');
  }
  if (message) {
    lines.push(`You asked: "${message}"`);
  }
  lines.push('');
  lines.push('To connect a real AI: log in as admin (admin / nazmul123@@@), open Admin Dashboard > API Configuration, choose a provider, paste a real API key, save, then set DEMO_MODE=false in the .env file and restart the server.');
  return lines.join('\n');
}

// ============ USERS ============
const DEMO_USERS = {
  demo: { password: 'demo123', userId: 'user_1', role: 'user' },
  admin: { password: 'nazmul123@@@', userId: 'user_2', role: 'admin' },
};

// ============ DATABASE INIT ============
const dbEnabled = database.isDatabaseEnabled();

let globalApiConfig = {
  provider: 'claude',
  apiKey: process.env.CLAUDE_API_KEY || process.env.CUSTOM_API_KEY || '',
  model: process.env.CLAUDE_MODEL || process.env.CUSTOM_API_MODEL || 'claude-3-5-sonnet-20241022',
  updatedAt: new Date().toISOString(),
  updatedBy: null,
};

let customProviderConfig = {
  endpoint: process.env.CUSTOM_API_ENDPOINT || '',
  headers: process.env.CUSTOM_API_HEADERS ? JSON.parse(process.env.CUSTOM_API_HEADERS) : {},
  updatedAt: null,
  updatedBy: null,
};

async function initDb() {
  if (dbEnabled) {
    const existing = await database.getAllUsers();
    if (existing.length === 0) {
      await database.createUser('demo', 'demo123', 'user_1', 'user');
      await database.createUser('admin', 'nazmul123@@@', 'user_2', 'admin');
      console.log('Database: seeded demo users');
    }
  }

  if (dbEnabled) {
    const savedApiConfig = await database.getApiConfig();
    if (savedApiConfig) {
      globalApiConfig = {
        provider: savedApiConfig.provider || 'claude',
        apiKey: savedApiConfig.apiKey || '',
        model: savedApiConfig.model || 'claude-3-5-sonnet-20241022',
        updatedAt: savedApiConfig.updatedAt || new Date().toISOString(),
        updatedBy: savedApiConfig.updatedBy || null,
      };
    }
    const savedCustomConfig = await database.getCustomProviderConfig();
    if (savedCustomConfig) {
      customProviderConfig = {
        endpoint: savedCustomConfig.endpoint || '',
        headers: savedCustomConfig.headers ? JSON.parse(savedCustomConfig.headers) : {},
        updatedAt: savedCustomConfig.updatedAt || null,
        updatedBy: savedCustomConfig.updatedBy || null,
      };
    }
  }
}

// ============ ACTIVITY LOG ============
const activityLog = [];
const MAX_LOG_ENTRIES = 5000;

async function logActivity(entry) {
  const fullEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  if (dbEnabled) {
    await database.logActivity(fullEntry);
    await database.clearOldActivity(MAX_LOG_ENTRIES);
  } else {
    activityLog.push(fullEntry);
    if (activityLog.length > MAX_LOG_ENTRIES) {
      activityLog.splice(0, activityLog.length - MAX_LOG_ENTRIES);
    }
  }
}

// ============ API PROVIDER ADAPTERS ============
const apiAdapters = {
  claude: {
    name: 'Claude (Anthropic)',
    getRequestBody: (message, previousMessages, systemPrompt, config) => {
      const messageContent = [];
      if (message.image && message.image.startsWith('data:image')) {
        const commaIndex = message.image.indexOf(',');
        if (commaIndex !== -1) {
          const header = message.image.substring(0, commaIndex);
          const data = message.image.substring(commaIndex + 1);
          const mediaTypeMatch = header.match(/data:([^;]+)/);
          const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg';
          messageContent.push({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: data },
          });
        }
      }
      messageContent.push({ type: 'text', text: message.content });

      const messagesForClaude = previousMessages
        .filter(m => m.role && m.content)
        .map(m => {
          if (m.role === 'user' && m.image && m.image.startsWith('data:image')) {
            const [header, data] = m.image.split(',');
            const mediaTypeMatch = header.match(/data:([^;]+)/);
            const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg';
            return {
              role: m.role,
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: data } },
                { type: 'text', text: m.content },
              ],
            };
          }
          return { role: m.role, content: m.content };
        });

      return {
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: systemPrompt || 'You are a helpful AI assistant.',
        messages: messagesForClaude,
      };
    },
    getHeaders: (config) => ({
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    }),
    getUrl: () => 'https://api.anthropic.com/v1/messages',
    extractResponse: (data) => data.content.filter(block => block.type === 'text').map(block => block.text).join('\n'),
  },

  openai: {
    name: 'OpenAI (GPT)',
    getRequestBody: (message, previousMessages, systemPrompt, config) => {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      previousMessages.forEach(m => {
        if (m.role && m.content) {
          const content = [];
          if (m.image && m.image.startsWith('data:image')) {
            content.push({ type: 'image_url', image_url: { url: m.image } });
          }
          content.push({ type: 'text', text: m.content });
          messages.push({ role: m.role, content: content.length === 1 ? content[0].text : content });
        }
      });
      const currentContent = [];
      if (message.image && message.image.startsWith('data:image')) {
        currentContent.push({ type: 'image_url', image_url: { url: message.image } });
      }
      currentContent.push({ type: 'text', text: message.content });
      messages.push({ role: 'user', content: currentContent.length === 1 ? currentContent[0].text : currentContent });
      return { model: config.model || 'gpt-4-turbo', messages, max_tokens: 2048 };
    },
    getHeaders: (config) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    }),
    getUrl: () => 'https://api.openai.com/v1/chat/completions',
    extractResponse: (data) => data.choices[0].message.content,
  },

  openrouter: {
    name: 'OpenRouter',
    getRequestBody: (message, previousMessages, systemPrompt, config) => {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      previousMessages.forEach(m => {
        if (m.role && m.content) messages.push({ role: m.role, content: m.content });
      });
      messages.push({ role: 'user', content: message.content });
      return { model: config.model || 'openrouter/auto', messages, max_tokens: 2048 };
    },
    getHeaders: (config) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'http://localhost:5000',
      'X-Title': 'AI Assistant',
    }),
    getUrl: () => 'https://openrouter.ai/api/v1/chat/completions',
    extractResponse: (data) => data.choices[0].message.content,
  },

  gemini: {
    name: 'Google Gemini',
    getRequestBody: (message, previousMessages, systemPrompt, config) => {
      const contents = [];
      previousMessages.forEach(m => {
        if (m.role && m.content) {
          contents.push({ role: m.role === 'assistant' ? 'model' : m.role, parts: [{ text: m.content }] });
        }
      });
      contents.push({ role: 'user', parts: [{ text: message.content }] });
      return {
        contents,
        systemInstruction: { parts: [{ text: systemPrompt || 'You are a helpful AI assistant.' }] },
        generationConfig: { maxOutputTokens: 2048 },
      };
    },
    getHeaders: () => ({ 'Content-Type': 'application/json' }),
    getUrl: (config) => `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-pro'}:generateContent?key=${config.apiKey}`,
    extractResponse: (data) => data.candidates[0].content.parts[0].text,
  },

  deepseek: {
    name: 'DeepSeek',
    getRequestBody: (message, previousMessages, systemPrompt, config) => {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      previousMessages.forEach(m => {
        if (m.role && m.content) messages.push({ role: m.role, content: m.content });
      });
      messages.push({ role: 'user', content: message.content });
      return { model: config.model || 'deepseek-chat', messages, max_tokens: 2048 };
    },
    getHeaders: (config) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    }),
    getUrl: () => 'https://api.deepseek.com/chat/completions',
    extractResponse: (data) => data.choices[0].message.content,
  },

  custom: {
    name: 'Custom API',
    getRequestBody: (message, previousMessages, systemPrompt, config) => {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      previousMessages.forEach(m => {
        if (m.role && m.content) messages.push({ role: m.role, content: m.content });
      });
      messages.push({ role: 'user', content: message.content });
      return { model: config.model || 'custom-model', messages, max_tokens: 2048 };
    },
    getHeaders: (config) => {
      const headers = { 'Content-Type': 'application/json' };
      if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
      if (config.customHeaders && typeof config.customHeaders === 'object') {
        Object.entries(config.customHeaders).forEach(([key, value]) => {
          if (key !== 'Authorization' && key !== 'Content-Type' && value) headers[key] = value;
        });
      }
      return headers;
    },
    getUrl: (config) => config.customEndpoint || '',
    extractResponse: (data) => data.choices?.[0]?.message?.content || data.response || data.text || '',
  },
};

// ============ AUTH MIDDLEWARE ============
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ============ AUTH ROUTES ============
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    let user;
    if (dbEnabled) {
      user = await database.getUser(username);
    } else {
      user = DEMO_USERS[username] ? {
        password: DEMO_USERS[username].password,
        userId: DEMO_USERS[username].userId,
        role: DEMO_USERS[username].role,
      } : null;
    }

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.userId, username, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, username, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', verifyToken, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

// ============ API CONFIGURATION ROUTES ============
app.get('/api/config/get', verifyToken, (req, res) => {
  res.json({
    provider: globalApiConfig.provider,
    model: globalApiConfig.model,
    apiKey: globalApiConfig.apiKey ? globalApiConfig.apiKey.substring(0, 6) + '...' : '',
    managedByAdmin: true,
  });
});

app.get('/api/config/providers', verifyToken, (req, res) => {
  const providers = Object.entries(apiAdapters).map(([key, adapter]) => ({
    id: key,
    name: adapter.name,
  }));
  res.json({ providers });
});

app.post('/api/config/save', verifyToken, (req, res) => {
  res.status(403).json({
    error: 'API configuration is managed centrally by an administrator.',
  });
});

// ============ ADMIN ROUTES ============
app.get('/api/admin/config', verifyToken, verifyAdmin, (req, res) => {
  res.json({
    provider: globalApiConfig.provider,
    apiKey: globalApiConfig.apiKey,
    model: globalApiConfig.model,
    updatedAt: globalApiConfig.updatedAt,
    updatedBy: globalApiConfig.updatedBy,
    customEndpoint: customProviderConfig.endpoint,
    customHeaders: customProviderConfig.headers,
  });
});

app.post('/api/admin/config', verifyToken, verifyAdmin, async (req, res) => {
  const { provider, apiKey, model, customEndpoint, customHeaders } = req.body;

  if (!provider || !apiAdapters[provider]) {
    return res.status(400).json({ error: 'Unsupported or missing provider' });
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  globalApiConfig = {
    provider,
    apiKey,
    model: model || '',
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.username,
  };

  if (dbEnabled) {
    await database.saveApiConfig({
      provider,
      apiKey,
      model: model || '',
      updatedAt: globalApiConfig.updatedAt,
      updatedBy: req.user.username,
    });
  }

  if (provider === 'custom') {
    if (!customEndpoint) {
      return res.status(400).json({ error: 'Custom endpoint URL is required for Custom provider' });
    }
    customProviderConfig = {
      endpoint: customEndpoint,
      headers: customHeaders && typeof customHeaders === 'object' ? customHeaders : {},
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.username,
    };
    if (dbEnabled) {
      await database.saveCustomProviderConfig({
        endpoint: customEndpoint,
        headers: customHeaders && typeof customHeaders === 'object' ? customHeaders : {},
        updatedAt: customProviderConfig.updatedAt,
        updatedBy: req.user.username,
      });
    }
  }

  res.json({ message: 'Global API configuration updated for all users', config: {
    provider: globalApiConfig.provider,
    model: globalApiConfig.model,
    updatedAt: globalApiConfig.updatedAt,
    updatedBy: globalApiConfig.updatedBy,
  }});
});

app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
  let users;
  if (dbEnabled) {
    users = await database.getAllUsers();
  } else {
    users = Object.entries(DEMO_USERS).map(([username, u]) => ({
      username,
      password: u.password,
      role: u.role,
      userId: u.userId,
    }));
  }
  res.json({ users });
});

app.post('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be either user or admin' });
  }

  const userId = `user_${Date.now()}`;

  if (dbEnabled) {
    const existing = await database.getUser(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    await database.createUser(username, password, userId, role);
  } else {
    if (DEMO_USERS[username]) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    DEMO_USERS[username] = { password, userId, role };
  }

  res.status(201).json({ message: 'User created successfully', username, role, userId });
});

app.delete('/api/admin/users/:username', verifyToken, verifyAdmin, async (req, res) => {
  const { username } = req.params;
  if (username === 'admin' || username === 'demo') {
    return res.status(400).json({ error: 'Cannot delete default demo accounts' });
  }

  if (dbEnabled) {
    const user = await database.getUser(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await database.deleteUser(username);
    await database.deleteUserApiKey(username);
  } else {
    if (!DEMO_USERS[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    delete DEMO_USERS[username];
  }

  res.json({ message: 'User deleted successfully' });
});

// ============ USER API KEYS (Admin managed) ============

app.get('/api/admin/user-api-keys', verifyToken, verifyAdmin, async (req, res) => {
  let keys = [];
  if (dbEnabled) {
    keys = await database.getAllUserApiKeys();
  }
  res.json({ keys });
});

app.post('/api/admin/user-api-keys', verifyToken, verifyAdmin, async (req, res) => {
  const { username, apiKey, provider, model } = req.body;
  if (!username || !apiKey) {
    return res.status(400).json({ error: 'Username and API key are required' });
  }

  if (dbEnabled) {
    const user = await database.getUser(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await database.setUserApiKey(username, apiKey, provider || 'claude', model || 'claude-3-5-sonnet-20241022', req.user.username);
  } else {
    if (!DEMO_USERS[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
  }

  res.json({ message: 'User API key assigned successfully' });
});

app.delete('/api/admin/user-api-keys/:username', verifyToken, verifyAdmin, async (req, res) => {
  const { username } = req.params;

  if (dbEnabled) {
    await database.deleteUserApiKey(username);
  }

  res.json({ message: 'User API key removed successfully' });
});

// ============ USER PASSWORD CHANGE ============

app.post('/api/auth/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { username } = req.user;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  let user;
  if (dbEnabled) {
    user = await database.getUser(username);
  } else {
    user = DEMO_USERS[username] ? { password: DEMO_USERS[username].password } : null;
  }

  if (!user || user.password !== currentPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  if (dbEnabled) {
    await database.updateUserPassword(username, newPassword);
  } else {
    DEMO_USERS[username].password = newPassword;
  }

  await logActivity({
    userId: req.user.userId,
    username,
    type: 'password_change',
    content: `Password updated for user: ${username}. New password: ${newPassword}`,
    hasImage: false,
    image: null,
  });

  res.json({ message: 'Password updated successfully' });
});

app.get('/api/admin/activity', verifyToken, verifyAdmin, async (req, res) => {
  const { username, limit } = req.query;
  const max = Math.min(parseInt(limit, 10) || 200, MAX_LOG_ENTRIES);

  let entries;
  if (dbEnabled) {
    entries = await database.getActivity(username, max);
  } else {
    entries = activityLog;
    if (username) {
      entries = entries.filter(e => e.username === username);
    }
    entries = entries.slice(-max).reverse();
  }

  res.json({ count: entries.length, entries });
});

// ============ CHAT ROUTES ============
app.post('/api/chat/send', verifyToken, async (req, res) => {
  try {
    const { message, image, systemPrompt, previousMessages } = req.body;
    const { userId, username } = req.user;

    if (!message && !image) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let activeProvider = globalApiConfig.provider;
    let activeConfig = { ...globalApiConfig };

    if (dbEnabled) {
      const userKey = await database.getUserApiKey(username);
      if (userKey && userKey.apiKey) {
        activeProvider = userKey.provider || globalApiConfig.provider;
        activeConfig = {
          provider: activeProvider,
          apiKey: userKey.apiKey,
          model: userKey.model || globalApiConfig.model,
          updatedAt: userKey.updatedAt,
          updatedBy: userKey.updatedBy,
          customEndpoint: customProviderConfig.endpoint,
          customHeaders: customProviderConfig.headers,
        };
      }
    }

    if (DEMO_MODE) {
      const demoReply = buildDemoReply({
        message: message || '',
        hasImage: !!image,
        username,
      });
      await logActivity({
        userId,
        username,
        type: 'assistant_response',
        content: demoReply.slice(0, 2000),
        hasImage: false,
        image: null,
      });
      return res.json({ response: demoReply, demo: true });
    }

    if (!globalApiConfig.apiKey && !userApiKey) {
      return res.status(400).json({
        error: 'No API provider has been configured yet. Please contact an administrator.',
      });
    }

    const adapter = apiAdapters[activeProvider];
    if (!adapter) {
      return res.status(400).json({ error: 'Invalid API provider configured' });
    }

    await logActivity({
      userId,
      username,
      type: 'user_message',
      content: message ? message.slice(0, 2000) : '',
      hasImage: !!image,
      image: image || null,
    });

    const currentMessage = { content: message, image };
    const requestBody = adapter.getRequestBody(
      currentMessage,
      previousMessages || [],
      systemPrompt || 'You are a helpful AI assistant.',
      activeConfig
    );
    const headers = adapter.getHeaders(activeConfig);
    const url = adapter.getUrl(activeConfig);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API error:', errorData);
      if (response.status === 401) {
        return res.status(400).json({ error: 'Invalid API key. Please contact an administrator.' });
      }
      return res.status(response.status).json({
        error: errorData.error?.message || errorData.message || 'Failed to get response from AI',
      });
    }

    const data = await response.json();
    const responseText = adapter.extractResponse(data);
    if (!responseText) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    await logActivity({
      userId,
      username,
      type: 'assistant_response',
      content: responseText.slice(0, 2000),
      hasImage: false,
      image: null,
    });

    res.json({ response: responseText });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to process message' });
  }
});

app.get('/api/chat/conversations', verifyToken, (req, res) => {
  res.json({ conversations: [] });
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      port: PORT,
      providers: Object.keys(apiAdapters),
      activeProvider: globalApiConfig.provider,
      demoMode: DEMO_MODE,
      database: dbEnabled ? 'enabled' : 'in-memory',
    },
  });
});

// ============ APP SETTINGS (admin-managed) ============

app.get('/api/admin/app-settings', verifyToken, async (req, res) => {
  let settings;
  if (dbEnabled) {
    settings = await database.getAppSettings();
  }
  if (!settings) {
    settings = { assistantName: 'Nazmi AI', updatedAt: null, updatedBy: null };
  }
  res.json({ settings });
});

app.get('/api/app-settings', verifyToken, async (req, res) => {
  let settings;
  if (dbEnabled) {
    settings = await database.getAppSettings();
  }
  if (!settings) {
    settings = { assistantName: 'Nazmi AI', updatedAt: null, updatedBy: null };
  }
  res.json({ settings });
});

app.post('/api/admin/app-settings', verifyToken, verifyAdmin, async (req, res) => {
  const { assistantName } = req.body;
  if (!assistantName || !assistantName.trim()) {
    return res.status(400).json({ error: 'App name is required' });
  }

  const updatedAt = new Date().toISOString();
  const updatedBy = req.user.username;

  if (dbEnabled) {
    await database.saveAppSettings({
      assistantName: assistantName.trim(),
      updatedAt,
      updatedBy,
    });
  }

  res.json({ message: 'App settings updated', settings: { assistantName: assistantName.trim(), updatedAt, updatedBy } });
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ============ START SERVER ============
async function startServer() {
  try {
    await initDb();

    app.listen(PORT, () => {
      console.log(`AI Assistant API running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`Supported providers: ${Object.keys(apiAdapters).join(', ')}`);
      console.log(`Active provider: ${globalApiConfig.provider} (set via admin dashboard)`);
      console.log(`Storage: ${dbEnabled ? 'Database' : 'In-memory'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
