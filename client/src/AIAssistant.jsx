import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, Menu, X, Settings, LogOut, Upload, Wand2, MessageCircle,
  Search, Trash2, Copy, Check, AlertCircle, ShieldCheck, Users, KeyRound,
  Eye, EyeOff, Activity, Cpu, Sparkles, ChevronLeft, Lock, User,
  RefreshCw, Shield, Zap, Globe,
} from 'lucide-react';

const AIAssistant = () => {
  // ============ AUTH STATE ============
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('authToken'));
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [role, setRole] = useState(() => localStorage.getItem('role') || 'user');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const isAdmin = role === 'admin';

  // ============ CHAT STATE ============
  const [conversations, setConversations] = useState(() => {
    return JSON.parse(localStorage.getItem('conversations')) || [];
  });
  const [currentConversationId, setCurrentConversationId] = useState(() => {
    return localStorage.getItem('currentConversationId') || null;
  });
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // ============ UI STATE ============
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  // ============ AI IDENTITY CONFIG ============
  const [aiConfig, setAiConfig] = useState(() => {
    return JSON.parse(localStorage.getItem('aiConfig')) || {
      name: 'Nazmi',
      systemPrompt: 'You are a helpful, intelligent, and thoughtful personal AI assistant. You provide clear, concise, and accurate responses.',
      personality: 'professional and friendly',
      responseStyle: 'balanced',
      language: 'English',
    };
  });
  const [editingConfig, setEditingConfig] = useState(aiConfig);

  // ============ APP NAME (admin-managed) ============
  const [appName, setAppName] = useState(() => localStorage.getItem('appName') || 'Nazmi AI');

  // ============ API CONFIG (admin-managed, read-only mirror) ============
  const [apiConfig, setApiConfig] = useState({ provider: 'claude', apiKey: '', model: '', managedByAdmin: true });
  const [availableProviders, setAvailableProviders] = useState([]);

  // ============ ADMIN: global API config ============
  const [adminApiConfig, setAdminApiConfig] = useState({ provider: 'claude', apiKey: '', model: '', customEndpoint: '', customHeaders: '' });
  const [adminConfigError, setAdminConfigError] = useState('');
  const [adminConfigSuccess, setAdminConfigSuccess] = useState('');
  const [adminConfigMeta, setAdminConfigMeta] = useState(null);

  // ============ ADMIN: activity log ============
  const [adminUsers, setAdminUsers] = useState([]);
  const [activityFilter, setActivityFilter] = useState('');
  const [activityEntries, setActivityEntries] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [adminTab, setAdminTab] = useState('activity'); // 'activity' | 'config' | 'users' | 'api-keys'

  // ============ ADMIN: user management ============
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // ============ ADMIN: user API keys ============
  const [userApiKeys, setUserApiKeys] = useState([]);
  const [selectedUserForKey, setSelectedUserForKey] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [apiKeyProvider, setApiKeyProvider] = useState('claude');
  const [apiKeyModel, setApiKeyModel] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeySuccess, setApiKeySuccess] = useState('');

  // ============ ADMIN: app settings ============
  const [appSettings, setAppSettings] = useState({ assistantName: 'Nazmi AI' });
  const [appSettingsLoading, setAppSettingsLoading] = useState(false);
  const [appSettingsError, setAppSettingsError] = useState('');
  const [appSettingsSuccess, setAppSettingsSuccess] = useState('');

  // ============ USER: change password ============
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordUser, setNewPasswordUser] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // ============ IMAGE EDIT MODE ============
  const [imageEditMode, setImageEditMode] = useState(false);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');

  // ============ REFS ============
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageEditInputRef = useRef(null);

  const API_BASE_URL = '/api';
  const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('authToken')}` });
// ============ EFFECTS ============
  useEffect(() => {
    if (currentConversationId) {
      const conv = conversations.find(c => c.id === currentConversationId);
      setMessages(conv ? conv.messages || [] : []);
    } else {
      setMessages([]);
    }
  }, [currentConversationId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (isLoggedIn) {
      loadProviders();
      loadApiConfig();
      loadGlobalAppName();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode ? 'true' : 'false');
  }, [darkMode]);

  useEffect(() => {
    if (appName) {
      document.title = `${appName} — Premium AI Assistant`;
    }
  }, [appName]);

  useEffect(() => {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = isLoggedIn ? '/icon-192.png' : 'data:,';
  }, [isLoggedIn]);

  // ============ LOADERS ============
  const loadProviders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/config/providers`, { headers: authHeader() });
      if (response.ok) {
        const data = await response.json();
        setAvailableProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  // Every user reads the same global config — read-only mirror here.
  const loadApiConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/config/get`, { headers: authHeader() });
      if (response.ok) {
        const data = await response.json();
        setApiConfig(data);
      }
    } catch (err) {
      console.error('Failed to load API config:', err);
    }
  };

  const loadGlobalAppName = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/app-settings`, { headers: authHeader() });
      if (response.ok) {
        const data = await response.json();
        const name = data.settings?.assistantName || 'Nazmi AI';
        setAppName(name);
        localStorage.setItem('appName', name);
      }
    } catch (err) {
      console.error('Failed to load app name:', err);
    }
  };

  // ============ ADMIN: global config ============
  const loadAdminConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/config`, { headers: authHeader() });
      if (response.ok) {
        const data = await response.json();
        setAdminApiConfig({
          provider: data.provider,
          apiKey: data.apiKey,
          model: data.model || '',
          customEndpoint: data.customEndpoint || '',
          customHeaders: typeof data.customHeaders === 'object' ? JSON.stringify(data.customHeaders, null, 2) : (data.customHeaders || ''),
        });
        setAdminConfigMeta({ updatedAt: data.updatedAt, updatedBy: data.updatedBy });
      }
    } catch (err) {
      console.error('Failed to load admin config:', err);
    }
  };

  const handleSaveAdminConfig = async () => {
    setAdminConfigError('');
    setAdminConfigSuccess('');
    try {
      const body = {
        provider: adminApiConfig.provider,
        apiKey: adminApiConfig.apiKey,
        model: adminApiConfig.model,
      };
      if (adminApiConfig.provider === 'custom') {
        try {
          body.customHeaders = JSON.parse(adminApiConfig.customHeaders || '{}');
        } catch (e) {
          setAdminConfigError('Custom headers must be valid JSON');
          return;
        }
        body.customEndpoint = adminApiConfig.customEndpoint;
      }
      const response = await fetch(`${API_BASE_URL}/admin/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.ok) {
        setAdminConfigError('');
        setAdminConfigSuccess('Saved — this configuration is now live for every user.');
        setAdminConfigMeta({ updatedAt: data.config.updatedAt, updatedBy: data.config.updatedBy });
        loadApiConfig();
        setTimeout(() => setAdminConfigSuccess(''), 3000);
      } else {
        setAdminConfigError(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      setAdminConfigError('Error saving configuration: ' + err.message);
    }
  };

  // ============ ADMIN: users & activity ============
  const loadAdminUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users`, { headers: authHeader() });
      if (response.ok) {
        const data = await response.json();
        setAdminUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadActivity = async (filterUsername = activityFilter) => {
    setActivityLoading(true);
    try {
      const qs = filterUsername ? `?username=${encodeURIComponent(filterUsername)}` : '';
      const response = await fetch(`${API_BASE_URL}/admin/activity${qs}`, { headers: authHeader() });
      if (response.ok) {
        const data = await response.json();
        setActivityEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const openAdminDashboard = () => {
    setShowAdminDashboard(true);
    setAdminTab('activity');
    loadAdminConfig();
    loadAdminUsers();
    loadActivity('');
    loadUserApiKeys();
    loadAppSettings();
  };

  // ============ ADMIN: app settings ============
  const loadAppSettings = async () => {
    setAppSettingsLoading(true);
    setAppSettingsError('');
    try {
      const response = await fetch(`${API_BASE_URL}/admin/app-settings`, { headers: authHeader() });
      if (response.ok) {
        const data = await response.json();
        setAppSettings({ assistantName: data.settings?.assistantName || 'Nazmi AI' });
      }
    } catch (err) {
      console.error('Failed to load app settings:', err);
    } finally {
      setAppSettingsLoading(false);
    }
  };

  const handleSaveAppSettings = async () => {
    setAppSettingsError('');
    setAppSettingsSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/admin/app-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ assistantName: appSettings.assistantName }),
      });
      const data = await response.json();
      if (response.ok) {
        setAppSettingsSuccess('App name updated successfully');
        setAppSettings({ assistantName: data.settings.assistantName });
        setTimeout(() => setAppSettingsSuccess(''), 3000);
      } else {
        setAppSettingsError(data.error || 'Failed to save app settings');
      }
    } catch (err) {
      setAppSettingsError('Error saving app settings: ' + err.message);
    }
  };

// ============ ADMIN: user API keys ============
  const loadUserApiKeys = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/user-api-keys`, { headers: authHeader() });
      if (response.ok) {
        const data = await response.json();
        setUserApiKeys(data.keys || []);
      }
    } catch (err) {
      console.error('Failed to load user API keys:', err);
    }
  };

  const handleAssignApiKey = async () => {
    setApiKeyError('');
    setApiKeySuccess('');
    if (!selectedUserForKey || !newApiKey.trim()) {
      setApiKeyError('Select a user and enter an API key');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/admin/user-api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ username: selectedUserForKey, apiKey: newApiKey.trim(), provider: apiKeyProvider, model: apiKeyModel.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        setApiKeySuccess('API key assigned successfully');
        setNewApiKey('');
        setApiKeyModel('');
        loadUserApiKeys();
        setTimeout(() => setApiKeySuccess(''), 3000);
      } else {
        setApiKeyError(data.error || 'Failed to assign API key');
      }
    } catch (err) {
      setApiKeyError('Error assigning API key: ' + err.message);
    }
  };

  const handleRemoveApiKey = async (username) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/user-api-keys/${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      if (response.ok) {
        setApiKeySuccess('API key removed');
        loadUserApiKeys();
        setTimeout(() => setApiKeySuccess(''), 3000);
      }
    } catch (err) {
      setApiKeyError('Error removing API key: ' + err.message);
    }
  };

  // ============ USER: change password ============
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!currentPassword || !newPasswordUser || !confirmNewPassword) {
      setPasswordError('All fields are required');
      return;
    }
    if (newPasswordUser !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPasswordUser.length < 4) {
      setPasswordError('New password must be at least 4 characters');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ currentPassword, newPassword: newPasswordUser }),
      });
      const data = await response.json();
      if (response.ok) {
        setPasswordSuccess('Password updated successfully');
        setCurrentPassword('');
        setNewPasswordUser('');
        setConfirmNewPassword('');
        setTimeout(() => { setPasswordSuccess(''); setShowPasswordModal(false); }, 900);
      } else {
        setPasswordError(data.error || 'Failed to update password');
      }
    } catch (err) {
      setPasswordError('Error updating password: ' + err.message);
    }
  };

  // ============ AUTH ============
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setLoginError('Please enter username and password');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setLoginError('Invalid credentials');
        setLoginLoading(false);
        return;
      }
      const data = await response.json();
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('username', data.username);
      localStorage.setItem('role', data.role);
      setRole(data.role);
      setIsLoggedIn(true);
      setLoginError('');
      setPassword('');
    } catch (err) {
      setLoginError('Login failed. Please try again.');
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setRole('user');
    setConversations([]);
    setCurrentConversationId(null);
    setMessages([]);
    setShowAdminDashboard(false);
  };
  // ============ CHAT ============
  const handleNewChat = () => {
    const newConversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setConversations([newConversation, ...conversations]);
    setCurrentConversationId(newConversation.id);
    setMessages([]);
    setInputValue('');
    setAttachedImage(null);
    setImagePreview(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result);
        setAttachedImage(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageEditUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditImagePreview(event.target?.result);
        setEditImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() && !attachedImage) return;

    if (!currentConversationId) {
      handleNewChat();
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      image: imagePreview,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setAttachedImage(null);
    setImagePreview(null);
    setIsLoading(true);

    let aiMessage = null;

    try {
      const response = await fetch(`${API_BASE_URL}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          conversationId: currentConversationId,
          message: userMessage.content,
          image: userMessage.image,
          systemPrompt: aiConfig.systemPrompt,
          previousMessages: updatedMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        aiMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Error: ${errorData.error || 'Failed to get response'}`,
          timestamp: new Date().toISOString(),
        };
      } else {
        const data = await response.json();
        aiMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      aiMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    } finally {
      setIsLoading(false);
      const finalMessages = aiMessage ? [...updatedMessages, aiMessage] : updatedMessages;
      setMessages(finalMessages);
      setConversations(prev =>
        prev.map(conv =>
          conv.id === currentConversationId
            ? {
              ...conv,
              messages: finalMessages,
              updatedAt: new Date().toISOString(),
              title: finalMessages[0]?.content?.substring(0, 30) || 'New Chat',
            }
            : conv
        )
      );
    }
  };

  const handleDeleteConversation = (id) => {
    setConversations(prev => prev.filter(conv => conv.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  };

  const handleSaveConfig = () => {
    setAiConfig(editingConfig);
    localStorage.setItem('aiConfig', JSON.stringify(editingConfig));
    setShowSettings(false);
  };

  const handleCopyMessage = (content, index) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ============ HELPERS ============
  const filteredConversations = conversations.filter(conv =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const timeAgo = (iso) => {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  const activityStat = (type) => activityEntries.filter(e => e.type === type).length;
  const userInitials = (name) => (name || '?').slice(0, 2).toUpperCase();
// ============ MODAL WRAPPERS ============
  const ModalShell = ({ children, onClose, wide }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto nice-scroll page-enter ${darkMode ? 'glass-dark text-slate-100' : 'glass text-slate-900'} rounded-3xl shadow-2xl p-6 sm:p-8`}>
        {children}
      </div>
    </div>
  );

  // ============ LOGIN SCREEN ============
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-slate-950">
        {/* Animated gradient blobs */}
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-violet-600/40 blur-[120px] animate-blob" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] rounded-full bg-fuchsia-600/30 blur-[130px] animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/4 w-[460px] h-[460px] rounded-full bg-indigo-600/40 blur-[120px] animate-blob animation-delay-4000" />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '36px 36px' }} />

        <div className="relative min-h-screen flex items-center justify-center p-4 page-enter">
          <div className="w-full max-w-md">
            {/* Brand */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 shadow-lift mb-4">
                <Sparkles size={30} className="text-white" />
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                {appName}
              </h1>
              <p className="text-slate-400 mt-2 text-sm">Your premium personal AI assistant</p>
            </div>

            <div className={`${darkMode ? 'glass-dark' : 'glass'} rounded-3xl p-8 shadow-2xl backdrop-blur-2xl`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Lock size={15} className="text-white" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Welcome back</h2>
              </div>

              {loginError && (
                <div className="mb-4 flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-400/40 text-rose-600 dark:text-rose-300 rounded-xl text-sm fade-in">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                       placeholder="username"
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="btn-glow w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loginLoading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <Zap size={17} />
                      Enter App
                    </>
                  )}
                </button>
              </form>


            </div>

            <p className="text-center text-slate-500 text-xs mt-6">
              Powered by multi-provider AI · Multi-API support
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============ MAIN APP SHELL ============
  return (
    <div className={`flex h-screen overflow-hidden relative ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Ambient background accents */}
      <div className="pointer-events-none fixed -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-violet-600/10 blur-[140px]" />
      <div className="pointer-events-none fixed -bottom-40 -left-40 w-[520px] h-[520px] rounded-full bg-fuchsia-600/10 blur-[140px]" />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed lg:static inset-y-0 left-0 z-30 lg:z-auto transition-transform duration-300 lg:translate-x-0 flex flex-col ${sidebarOpen ? 'w-72' : 'w-0'} ${darkMode ? 'glass-dark' : 'glass'} border-r ${darkMode ? 'border-slate-800' : 'border-slate-200/70'} overflow-hidden`}>
        <div className="p-5">
          <button
            onClick={handleNewChat}
            className="btn-glow w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold transition-all"
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
              }`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto nice-scroll px-3 pb-4">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageCircle size={30} className={`mx-auto mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>No conversations yet</p>
              <p className={`text-xs mt-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Start a new chat to begin</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setCurrentConversationId(conv.id)}
                className={`group mb-1.5 p-3 rounded-2xl cursor-pointer transition-all border ${
                  currentConversationId === conv.id
                    ? 'bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 text-white shadow-lift border-transparent'
                    : darkMode
                      ? 'hover:bg-slate-800/70 border-slate-800 text-slate-300'
                      : 'hover:bg-white/80 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${currentConversationId === conv.id ? 'text-white' : ''}`}>{conv.title}</p>
                    <p className={`text-xs mt-0.5 ${currentConversationId === conv.id ? 'text-white/70' : darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {timeAgo(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                    className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                      currentConversationId === conv.id ? 'hover:bg-white/20 text-white' : darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom actions */}
        <div className={`p-4 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200/70'} space-y-2`}>
          <button
            onClick={openAdminDashboard}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isAdmin
                ? 'bg-violet-600/15 text-violet-600 dark:text-violet-300 hover:bg-violet-600/25'
                : darkMode ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            <ShieldCheck size={16} />
            {isAdmin ? 'Admin Dashboard' : 'No admin access'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className={`relative z-10 ${darkMode ? 'glass-dark' : 'glass'} border-b ${darkMode ? 'border-slate-800' : 'border-slate-200/70'} px-4 sm:px-6 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-white/80'}`}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-soft shrink-0">
                <Sparkles size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm truncate">
                  {appName}
                </h1>
                <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Provider online · {username}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            {isAdmin && (
              <span className="hidden md:inline-flex px-2 py-1 rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-300 text-[11px] font-semibold">ADMIN</span>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-white/80'}`}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sparkles size={18} /> : <Sparkles size={18} className="text-amber-500" />}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-white/80'}`}
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => setShowPasswordModal(true)}
              className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-white/80'}`}
              aria-label="Change password"
            >
              <KeyRound size={18} />
            </button>
            <button
              onClick={handleLogout}
              className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-slate-800 text-rose-400' : 'hover:bg-white/80 text-rose-500'}`}
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

{/* Messages area */}
        <main className="flex-1 overflow-y-auto nice-scroll px-4 sm:px-6 py-6 page-enter">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center fade-in">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 flex items-center justify-center shadow-lift mb-5 animate-blob">
                <MessageCircle size={28} className="text-white" />
              </div>
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                Hello{username ? `, ${username}` : ''} 👋
              </h2>
              <p className={`mt-2 max-w-md text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                I'm <span className="shimmer-text font-semibold">{appName}</span>, your premium AI assistant.
                Ask me anything, upload an image, or start a fresh conversation below.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.map((msg, index) => (
                <div key={msg.id} className={`flex msg-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2.5 max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role !== 'user' && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 mt-1">
                        <Sparkles size={14} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-soft ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-br-md'
                          : darkMode ? 'bg-slate-800 text-slate-100 rounded-bl-md border border-slate-700/60' : 'bg-white text-slate-800 rounded-bl-md border border-slate-200/70'
                      }`}
                    >
                      {msg.image && (
                        <img src={msg.image} alt="attached" className="w-40 h-40 rounded-xl mb-2.5 object-cover border border-white/10" />
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      <div className="flex items-center justify-between mt-2 gap-3">
                        <span className={`text-[11px] ${msg.role === 'user' ? 'text-white/70' : darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => handleCopyMessage(msg.content, index)}
                          className={`p-1 rounded-lg transition-colors ${msg.role === 'user' ? 'hover:bg-white/15' : darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                          aria-label="Copy message"
                        >
                          {copiedIndex === index ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start msg-in">
                  <div className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
                      <Sparkles size={14} className="text-white" />
                    </div>
                    <div className={`px-4 py-3 rounded-2xl rounded-bl-md ${darkMode ? 'bg-slate-800 border border-slate-700/60' : 'bg-white border border-slate-200/70'} flex items-center gap-2`}>
                      <span className="typing-dot w-2 h-2 rounded-full bg-violet-500" />
                      <span className="typing-dot w-2 h-2 rounded-full bg-fuchsia-500" style={{ animationDelay: '0.2s' }} />
                      <span className="typing-dot w-2 h-2 rounded-full bg-indigo-500" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>
        {/* Input area */}
        <footer className={`relative z-10 ${darkMode ? 'glass-dark' : 'glass'} border-t ${darkMode ? 'border-slate-800' : 'border-slate-200/70'} p-4 sm:p-5`}>
          <div className="max-w-3xl mx-auto">
            {imageEditMode && (
              <div className={`mb-4 p-4 rounded-2xl border fade-in ${darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
                <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
                  <Wand2 size={15} className="text-violet-500" /> Edit Image
                </h4>
                <input
                  ref={imageEditInputRef}
                  type="file"
                  onChange={handleImageEditUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
                {editImagePreview && (
                  <img src={editImagePreview} alt="edit preview" className="w-28 h-28 rounded-xl mb-3 object-cover border border-slate-300/40" />
                )}
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Describe how you want to edit this image…"
                  rows={2}
                  className={`w-full px-3 py-2.5 rounded-xl border mb-3 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                    darkMode ? 'bg-slate-900/60 border-slate-600 text-white' : 'bg-white border-slate-200'
                  }`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => imageEditInputRef.current?.click()}
                    className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors text-sm font-medium"
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => { setImageEditMode(false); setEditPrompt(''); setEditImagePreview(null); setEditImageFile(null); }}
                    className="flex-1 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-xl transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editImagePreview && editPrompt) {
                        setInputValue(`Edit image: ${editPrompt}`);
                        setImagePreview(editImagePreview);
                        setAttachedImage(editImageFile);
                        setImageEditMode(false);
                        setEditPrompt('');
                        setEditImagePreview(null);
                        setEditImageFile(null);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl transition-all text-sm font-medium"
                  >
                    Add to Chat
                  </button>
                </div>
              </div>
            )}

{imagePreview && (
              <div className={`mb-3 p-3 rounded-2xl flex items-center justify-between fade-in ${darkMode ? 'bg-slate-800/70' : 'bg-white/70 border border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <img src={imagePreview} alt="preview" className="w-11 h-11 rounded-xl object-cover" />
                  <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Image attached</span>
                </div>
                <button
                  onClick={() => { setImagePreview(null); setAttachedImage(null); }}
                  className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-200'} transition-colors`}
                  aria-label="Remove image"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex gap-1.5">
                <input ref={fileInputRef} type="file" onChange={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2.5 rounded-xl transition-colors ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-white/80'}`}
                  aria-label="Upload image"
                >
                  <Upload size={19} />
                </button>
                <button
                  onClick={() => setImageEditMode(!imageEditMode)}
                  className={`p-2.5 rounded-xl transition-colors ${imageEditMode ? 'bg-violet-600 text-white' : darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-white/80'}`}
                  aria-label="Edit image"
                >
                  <Wand2 size={19} />
                </button>
              </div>

              <div className={`flex-1 flex items-center gap-2 rounded-2xl border px-3 py-1.5 transition-all focus-within:ring-2 focus-within:ring-violet-500 ${darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Nazmi…"
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none py-2 text-sm max-h-28 nice-scroll"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || (!inputValue.trim() && !attachedImage)}
                  className="btn-glow w-10 h-10 shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white flex items-center justify-center disabled:opacity-50 disabled:shadow-none transition-all"
                  aria-label="Send message"
                >
                  {isLoading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send size={17} />}
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
{/* Settings modal */}
      {showSettings && (
        <ModalShell onClose={() => setShowSettings(false)}>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Settings size={16} className="text-white" />
            </div>
            <h2 className="text-lg font-bold flex-1">Assistant Settings</h2>
            <button onClick={() => setShowSettings(false)} className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">System Prompt</label>
              <textarea
                value={editingConfig.systemPrompt}
                onChange={(e) => setEditingConfig({ ...editingConfig, systemPrompt: e.target.value })}
                rows={4}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                  darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Personality</label>
              <select
                value={editingConfig.personality}
                onChange={(e) => setEditingConfig({ ...editingConfig, personality: e.target.value })}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                  darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                }`}
              >
                {['professional and friendly', 'casual', 'witty', 'formal'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Response Style</label>
              <select
                value={editingConfig.responseStyle}
                onChange={(e) => setEditingConfig({ ...editingConfig, responseStyle: e.target.value })}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                  darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                }`}
              >
                {['balanced', 'concise', 'detailed'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Language</label>
              <select
                value={editingConfig.language}
                onChange={(e) => setEditingConfig({ ...editingConfig, language: e.target.value })}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                  darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                }`}
              >
                {['English', 'Bengali', 'Hindi', 'Spanish', 'French'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveConfig}
                className="btn-glow flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm"
              >
                Save Changes
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} transition-colors`}
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalShell>
      )}

{/* Change password modal */}
      {showPasswordModal && (
        <ModalShell onClose={() => setShowPasswordModal(false)}>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <KeyRound size={16} className="text-white" />
            </div>
            <h2 className="text-lg font-bold flex-1">Change Password</h2>
            <button onClick={() => setShowPasswordModal(false)} className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {passwordSuccess && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-400/40 text-emerald-600 dark:text-emerald-300 rounded-xl text-sm fade-in">
              {passwordSuccess}
            </div>
          )}
          {passwordError && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-400/40 text-rose-600 dark:text-rose-300 rounded-xl text-sm fade-in">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {passwordError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                  darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">New Password</label>
              <input
                type="password"
                value={newPasswordUser}
                onChange={(e) => setNewPasswordUser(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                  darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                  darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                }`}
              />
            </div>
            <button
              onClick={handleChangePassword}
              className="btn-glow w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm"
            >
              Update Password
            </button>
          </div>
        </ModalShell>
      )}
{/* Admin dashboard */}
      {showAdminDashboard && isAdmin && (
        <ModalShell onClose={() => setShowAdminDashboard(false)} wide>
          {/* Header */}
          <div className="flex items-center gap-3 mb-5 pb-5 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200/70'}">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 flex items-center justify-center shadow-lift shrink-0">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                Admin Dashboard
                <span className="px-2 py-0.5 rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-300 text-[10px] font-semibold uppercase tracking-wide">Control Center</span>
              </h2>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Monitor user activity & manage the deployed AI configuration
              </p>
            </div>
            <button
              onClick={() => setShowAdminDashboard(false)}
              className={`p-2 rounded-xl ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}
              aria-label="Close dashboard"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className={`p-4 rounded-2xl border fade-in ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
              <div className="w-8 h-8 rounded-xl bg-violet-600/15 text-violet-600 dark:text-violet-300 flex items-center justify-center mb-2">
                <Users size={16} />
              </div>
              <p className="text-2xl font-bold">{adminUsers.length}</p>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total users</p>
            </div>
            <div className={`p-4 rounded-2xl border fade-in ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-2">
                <MessageCircle size={16} />
              </div>
              <p className="text-2xl font-bold">{activityStat('user_message')}</p>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Messages sent</p>
            </div>
            <div className={`p-4 rounded-2xl border fade-in ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center mb-2">
                <Cpu size={16} />
              </div>
              <p className="text-2xl font-bold">{activityStat('assistant_response')}</p>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>AI replies</p>
            </div>
            <div className={`p-4 rounded-2xl border fade-in ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300 flex items-center justify-center mb-2">
                <KeyRound size={16} />
              </div>
              <p className="text-2xl font-bold">{activityStat('password_change')}</p>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Password changes</p>
            </div>
          </div>

          {/* Provider status banner */}
          <div className={`mb-5 p-4 rounded-2xl border fade-in flex flex-wrap items-center justify-between gap-3 ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                <Globe size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">Active provider: {apiConfig.provider || '—'}</p>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {adminConfigMeta?.updatedAt
                    ? `Last updated ${timeAgo(adminConfigMeta.updatedAt)}${adminConfigMeta.updatedBy ? ` by ${adminConfigMeta.updatedBy}` : ''}`
                    : 'No configuration changes yet'}
                </p>
              </div>
            </div>
            <button
              onClick={() => { loadAdminUsers(); loadActivity(activityFilter); loadUserApiKeys(); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} transition-colors`}
            >
              <RefreshCw size={13} /> Refresh data
            </button>
          </div>
{/* Tabs */}
          <div className={`flex border-b ${darkMode ? 'border-slate-800' : 'border-slate-200/70'} mb-6 overflow-x-auto nice-scroll gap-1`}>
            {[
              { id: 'activity', label: 'User Activity', icon: <Activity size={15} /> },
              { id: 'config', label: 'API Config', icon: <KeyRound size={15} /> },
              { id: 'users', label: 'Users', icon: <Users size={15} /> },
              { id: 'api-keys', label: 'API Keys', icon: <Cpu size={15} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setAdminTab(tab.id);
                  if (tab.id === 'users') loadAdminUsers();
                  if (tab.id === 'activity') loadActivity(activityFilter);
                  if (tab.id === 'api-keys') loadUserApiKeys();
                  if (tab.id === 'config') loadAdminConfig();
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
                  adminTab === tab.id
                    ? 'border-violet-500 text-violet-600 dark:text-violet-300 bg-violet-600/5'
                    : `border-transparent ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ============ ACTIVITY TAB ============ */}
          {adminTab === 'activity' && (
            <div className="space-y-4 fade-in">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Live view of every message, image, and password change across all users.
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <select
                    value={activityFilter}
                    onChange={(e) => { setActivityFilter(e.target.value); loadActivity(e.target.value); }}
                    className={`flex-1 sm:w-auto px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                      darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                    }`}
                  >
                    <option value="">All users</option>
                    {adminUsers.map(u => (
                      <option key={u.username} value={u.username}>{u.username} ({u.role})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => loadActivity(activityFilter)}
                    className={`px-3 py-2 rounded-xl text-sm ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white/70 border border-slate-200 hover:bg-slate-100'} transition-colors`}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              <div className="max-h-[430px] overflow-y-auto nice-scroll space-y-2 pr-1">
                {activityLoading ? (
                  <div className={`flex items-center justify-center gap-3 py-10 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    Loading activity…
                  </div>
                ) : activityEntries.length === 0 ? (
                  <div className={`text-center py-10 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Activity size={28} className="mx-auto mb-2 opacity-60" />
                    <p className="text-sm">No activity yet — start chatting to populate this log.</p>
                  </div>
                ) : (
                  activityEntries.map((entry, i) => (
                    <div
                      key={entry.id}
                      className={`p-3.5 rounded-2xl border flex items-start gap-3 msg-in transition-all ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}
                      style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        entry.type === 'user_message'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : entry.type === 'password_change'
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-indigo-500/15 text-indigo-500'
                      }`}>
                        {entry.hasImage
                          ? <Upload size={15} />
                          : entry.type === 'password_change' ? <KeyRound size={15} /> : <MessageCircle size={15} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-semibold truncate">
                            {entry.username}
                            {entry.hasImage && <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-600/15 text-violet-500">IMAGE</span>}
                          </p>
                          <span className={`text-[11px] shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{timeAgo(entry.timestamp)}</span>
                        </div>
                        <p className={`text-xs break-words ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {entry.content || '(no text)'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
{/* ============ CONFIG TAB ============ */}
          {adminTab === 'config' && (
            <div className="space-y-4 fade-in max-w-2xl">
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                This single shared configuration is applied to every user instantly. Saving here updates it for everyone — nothing else to sync.
              </p>

              {adminConfigError && (
                <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-400/40 text-rose-600 dark:text-rose-300 rounded-xl text-sm">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {adminConfigError}
                </div>
              )}
              {adminConfigSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-400/40 text-emerald-600 dark:text-emerald-300 rounded-xl text-sm fade-in">
                  {adminConfigSuccess}
                </div>
              )}

              <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Globe size={15} className="text-violet-500" /> App Name
                </h4>
                <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  This name is shown to every user across the app. Only admins can change it.
                </p>
                {appSettingsError && (
                  <div className="mb-3 flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-400/40 text-rose-600 dark:text-rose-300 rounded-xl text-xs">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {appSettingsError}
                  </div>
                )}
                {appSettingsSuccess && (
                  <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-400/40 text-emerald-600 dark:text-emerald-300 rounded-xl text-xs fade-in">
                    {appSettingsSuccess}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={appSettings.assistantName}
                    onChange={(e) => setAppSettings({ ...appSettings, assistantName: e.target.value })}
                    placeholder="Enter app name"
                    className={`flex-1 px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                      darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                    }`}
                  />
                  <button
                    onClick={handleSaveAppSettings}
                    className="btn-glow px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Provider</label>
                <select
                  value={adminApiConfig.provider}
                  onChange={(e) => setAdminApiConfig({ ...adminApiConfig, provider: e.target.value, model: '' })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                    darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                  }`}
                >
                  {availableProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </div>

              {adminApiConfig.provider === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Custom Endpoint URL</label>
                    <input
                      type="text"
                      value={adminApiConfig.customEndpoint}
                      onChange={(e) => setAdminApiConfig({ ...adminApiConfig, customEndpoint: e.target.value })}
                      placeholder="https://your-api.com/v1/chat/completions"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                        darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Custom Headers (JSON, optional)</label>
                    <textarea
                      value={adminApiConfig.customHeaders}
                      onChange={(e) => setAdminApiConfig({ ...adminApiConfig, customHeaders: e.target.value })}
                      placeholder='{"X-Custom-Header": "value"}'
                      rows={3}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm resize-none font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                        darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                      }`}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">API Key</label>
                <input
                  type="password"
                  value={adminApiConfig.apiKey}
                  onChange={(e) => setAdminApiConfig({ ...adminApiConfig, apiKey: e.target.value })}
                  placeholder="Enter the provider's API key"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                    darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Model (optional)</label>
                <input
                  type="text"
                  value={adminApiConfig.model}
                  onChange={(e) => setAdminApiConfig({ ...adminApiConfig, model: e.target.value })}
                  placeholder="e.g., claude-sonnet-4-6, gpt-4-turbo"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                    darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                  }`}
                />
              </div>

              <button
                onClick={handleSaveAdminConfig}
                className="btn-glow w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                Save &amp; Apply to All Users
              </button>
            </div>
          )}
{/* ============ USERS TAB ============ */}
          {adminTab === 'users' && (
            <div className="grid md:grid-cols-2 gap-5 fade-in">
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Users size={15} className="text-violet-500" /> Create User
                </h4>
                {userError && (
                  <div className="mb-3 flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-400/40 text-rose-600 dark:text-rose-300 rounded-xl text-xs">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {userError}
                  </div>
                )}
                {userSuccess && (
                  <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-400/40 text-emerald-600 dark:text-emerald-300 rounded-xl text-xs fade-in">
                    {userSuccess}
                  </div>
                )}
                <div className={`p-4 rounded-2xl border space-y-3 ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Username</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="new_user"
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                        darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Password</label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                        darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['user', 'admin'].map(r => (
                        <button
                          key={r}
                          onClick={() => setNewUserRole(r)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                            newUserRole === r
                              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-soft'
                              : darkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setUserError('');
                      setUserSuccess('');
                      if (!newUsername.trim() || !newPassword.trim()) {
                        setUserError('Username and password are required');
                        return;
                      }
                      try {
                        const response = await fetch(`${API_BASE_URL}/admin/users`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...authHeader() },
                          body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newUserRole }),
                        });
                        const data = await response.json();
                        if (response.ok) {
                          setUserSuccess(`User "${newUsername.trim()}" created`);
                          setNewUsername('');
                          setNewPassword('');
                          loadAdminUsers();
                          setTimeout(() => setUserSuccess(''), 3000);
                        } else {
                          setUserError(data.error || 'Failed to create user');
                        }
                      } catch (err) {
                        setUserError('Error creating user: ' + err.message);
                      }
                    }}
                    className="btn-glow w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm"
                  >
                    Create User
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Shield size={15} className="text-violet-500" /> Existing Users
                </h4>
                <div className="max-h-[360px] overflow-y-auto nice-scroll space-y-2 pr-1">
                  {adminUsers.length === 0 ? (
                    <p className={`text-sm py-6 text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No users found</p>
                  ) : (
                    adminUsers.map(u => (
                      <div key={u.username} className={`p-3.5 rounded-2xl border flex items-center justify-between ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${u.role === 'admin' ? 'bg-violet-600/20 text-violet-500' : 'bg-slate-500/15 text-slate-500'}`}>
                            {userInitials(u.username)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{u.username}</p>
                            <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {u.role === 'admin' ? 'Administrator' : 'Regular user'}
                            </p>
                          </div>
                        </div>
                        {u.username !== 'admin' && u.username !== 'demo' && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete user "${u.username}"?`)) return;
                              try {
                                const response = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(u.username)}`, {
                                  method: 'DELETE',
                                  headers: authHeader(),
                                });
                                if (response.ok) {
                                  setUserSuccess(`User "${u.username}" deleted`);
                                  loadAdminUsers();
                                  setTimeout(() => setUserSuccess(''), 3000);
                                } else {
                                  const data = await response.json();
                                  setUserError(data.error || 'Failed to delete user');
                                }
                              } catch (err) {
                                setUserError('Error deleting user: ' + err.message);
                              }
                            }}
                            className={`p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors`}
                            aria-label={`Delete ${u.username}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
{/* ============ API KEYS TAB ============ */}
          {adminTab === 'api-keys' && (
            <div className="grid md:grid-cols-2 gap-5 fade-in">
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <KeyRound size={15} className="text-violet-500" /> Assign API Key
                </h4>
                <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Give a user their own key so their chats use it instead of the shared configuration.
                </p>
                {apiKeyError && (
                  <div className="mb-3 flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-400/40 text-rose-600 dark:text-rose-300 rounded-xl text-xs">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {apiKeyError}
                  </div>
                )}
                {apiKeySuccess && (
                  <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-400/40 text-emerald-600 dark:text-emerald-300 rounded-xl text-xs fade-in">
                    {apiKeySuccess}
                  </div>
                )}
                <div className={`p-4 rounded-2xl border space-y-3 ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">User</label>
                    <select
                      value={selectedUserForKey}
                      onChange={(e) => setSelectedUserForKey(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                        darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                      }`}
                    >
                      <option value="">Select a user…</option>
                      {adminUsers.map(u => (
                        <option key={u.username} value={u.username}>{u.username} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Provider</label>
                    <select
                      value={apiKeyProvider}
                      onChange={(e) => setApiKeyProvider(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                        darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                      }`}
                    >
                      {availableProviders.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
<div>
                    <label className="block text-xs font-medium mb-1.5">Model (optional)</label>
                    <input
                      type="text"
                      value={apiKeyModel}
                      onChange={(e) => setApiKeyModel(e.target.value)}
                      placeholder="e.g., claude-sonnet-4-6"
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                        darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">API Key</label>
                    <input
                      type="password"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="sk-…"
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all ${
                        darkMode ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-white/70 border-slate-200'
                      }`}
                    />
                  </div>
                  <button
                    onClick={handleAssignApiKey}
                    className="btn-glow w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold text-sm"
                  >
                    Assign API Key
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Cpu size={15} className="text-violet-500" /> Assigned Keys
                </h4>
                <div className="max-h-[360px] overflow-y-auto nice-scroll space-y-2 pr-1">
                  {userApiKeys.length === 0 ? (
                    <p className={`text-sm py-6 text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No API keys assigned yet</p>
                  ) : (
                    userApiKeys.map(k => (
                      <div key={k.username} className={`p-3.5 rounded-2xl border flex items-center justify-between ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-slate-200'}`}>
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-semibold">{k.username}</p>
                          <p className={`text-[11px] truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {k.provider} · {k.model || 'default model'} · <span className="font-mono">{k.apiKey?.slice(0, 8)}…</span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveApiKey(k.username)}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                          aria-label={`Remove API key for ${k.username}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </ModalShell>
      )}

      {/* Floating sidebar toggle on desktop when closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className={`fixed left-3 top-20 z-40 w-9 h-9 rounded-xl flex items-center justify-center shadow-soft hover:scale-105 transition-transform ${darkMode ? 'glass-dark text-slate-200' : 'glass text-slate-700'}`}
          aria-label="Open sidebar"
        >
          <ChevronLeft size={17} className="rotate-180" />
        </button>
      )}
    </div>
  );
};

export default AIAssistant;
