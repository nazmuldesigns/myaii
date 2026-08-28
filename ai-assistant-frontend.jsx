import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, Menu, X, Settings, LogOut, Upload, Wand2, MessageCircle,
  Search, Trash2, Copy, Check, AlertCircle, ShieldCheck, Users, KeyRound, Info,
} from 'lucide-react';

const AIAssistant = () => {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('authToken'));
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [role, setRole] = useState(() => localStorage.getItem('role') || 'user');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const isAdmin = role === 'admin';

  // Chat State
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

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  // AI Identity Config
  const [aiConfig, setAiConfig] = useState(() => {
    return JSON.parse(localStorage.getItem('aiConfig')) || {
      name: 'Alex',
      systemPrompt: 'You are a helpful, intelligent, and thoughtful personal AI assistant. You provide clear, concise, and accurate responses.',
      personality: 'professional and friendly',
      responseStyle: 'balanced',
      language: 'English',
    };
  });
  const [editingConfig, setEditingConfig] = useState(aiConfig);

  // API Configuration State (read-only mirror of the admin-managed global config)
  const [apiConfig, setApiConfig] = useState({ provider: 'claude', apiKey: '', model: '', managedByAdmin: true });
  const [availableProviders, setAvailableProviders] = useState([]);

  // Admin: global API config editor
  const [adminApiConfig, setAdminApiConfig] = useState({ provider: 'claude', apiKey: '', model: '', customEndpoint: '', customHeaders: '' });
  const [adminConfigError, setAdminConfigError] = useState('');
  const [adminConfigSuccess, setAdminConfigSuccess] = useState('');
  const [adminConfigMeta, setAdminConfigMeta] = useState(null); // { updatedAt, updatedBy }

  // Admin: activity log
  const [adminUsers, setAdminUsers] = useState([]);
  const [activityFilter, setActivityFilter] = useState('');
  const [activityEntries, setActivityEntries] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [adminTab, setAdminTab] = useState('config'); // 'config' | 'activity' | 'users'

  // Admin: user management
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Admin: user API keys
  const [userApiKeys, setUserApiKeys] = useState([]);
  const [selectedUserForKey, setSelectedUserForKey] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [apiKeyProvider, setApiKeyProvider] = useState('claude');
  const [apiKeyModel, setApiKeyModel] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeySuccess, setApiKeySuccess] = useState('');

  // User: change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordUser, setNewPasswordUser] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Image Edit Mode
  const [imageEditMode, setImageEditMode] = useState(false);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');

  // Refs
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageEditInputRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5001/api';
  const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('authToken')}` });

  // Load messages for current conversation
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
    }
  }, [isLoggedIn]);

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

  // Every user (admin or not) reads the same global config - it's read-only here.
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
    if (!adminApiConfig.apiKey.trim()) {
      setAdminConfigError('API Key is required');
      return;
    }
    try {
      let customHeadersObj = {};
      if (adminApiConfig.provider === 'custom' && adminApiConfig.customHeaders.trim()) {
        try {
          customHeadersObj = JSON.parse(adminApiConfig.customHeaders);
        } catch (e) {
          setAdminConfigError('Custom headers must be valid JSON');
          return;
        }
      }
      const body = {
        provider: adminApiConfig.provider,
        apiKey: adminApiConfig.apiKey,
        model: adminApiConfig.model,
        customEndpoint: adminApiConfig.provider === 'custom' ? adminApiConfig.customEndpoint : undefined,
        customHeaders: adminApiConfig.provider === 'custom' ? customHeadersObj : undefined,
      };
      const response = await fetch(`${API_BASE_URL}/admin/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.ok) {
        setAdminConfigError('');
        setAdminConfigSuccess('Saved. This is now live for every user.');
        setAdminConfigMeta({ updatedAt: data.config.updatedAt, updatedBy: data.config.updatedBy });
        loadApiConfig(); // refresh the read-only mirror too
        setTimeout(() => setAdminConfigSuccess(''), 3000);
      } else {
        setAdminConfigError(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      setAdminConfigError('Error saving configuration: ' + err.message);
    }
  };

  // ============ ADMIN: activity log ============

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
    setAdminTab('config');
    loadAdminConfig();
    loadAdminUsers();
    loadActivity('');
    loadUserApiKeys();
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
        setTimeout(() => setPasswordSuccess(''), 3000);
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
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setLoginError('Invalid credentials');
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

      let aiMessage;
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
      setMessages([...updatedMessages, aiMessage]);
    } catch (error) {
      setMessages([...updatedMessages, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
      setConversations(prev =>
        prev.map(conv =>
          conv.id === currentConversationId
            ? {
              ...conv,
              messages: updatedMessages,
              updatedAt: new Date().toISOString(),
              title: updatedMessages[0]?.content?.substring(0, 30) || 'New Chat',
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

  // ============ LOGIN SCREEN ============

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">AI Assistant</h1>
            <p className="text-center text-gray-600 mb-8">Login to continue</p>

            {loginError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {loginError}
                </div>
              )}

              {adminTab === 'api-keys' && (
                <div className="space-y-4">
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Assign a dedicated API key to each user. When a user has a personal key, the system uses it instead of the global configuration for their chat requests.
                  </p>

                  {apiKeyError && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                      {apiKeyError}
                    </div>
                  )}
                  {apiKeySuccess && (
                    <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
                      {apiKeySuccess}
                    </div>
                  )}

                  <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                    <h4 className={`font-medium text-sm mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      Assign API Key to User
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>User</label>
                        <select
                          value={selectedUserForKey}
                          onChange={(e) => setSelectedUserForKey(e.target.value)}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        >
                          <option value="">Select a user</option>
                          {adminUsers.map(u => (
                            <option key={u.username} value={u.username}>{u.username} ({u.role})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>API Provider</label>
                        <select
                          value={apiKeyProvider}
                          onChange={(e) => setApiKeyProvider(e.target.value)}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        >
                          {availableProviders.map(provider => (
                            <option key={provider.id} value={provider.id}>{provider.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Model (optional)</label>
                        <input
                          type="text"
                          value={apiKeyModel}
                          onChange={(e) => setApiKeyModel(e.target.value)}
                          placeholder="e.g., claude-sonnet-4-6, gpt-4-turbo"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>API Key</label>
                        <input
                          type="password"
                          value={newApiKey}
                          onChange={(e) => setNewApiKey(e.target.value)}
                          placeholder="Enter the user's API key"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        />
                      </div>
                      <button
                        onClick={handleAssignApiKey}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Assign API Key
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className={`font-medium text-sm mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      Assigned Keys
                    </h4>
                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                      {userApiKeys.length === 0 ? (
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No user API keys assigned</p>
                      ) : (
                        userApiKeys.map(k => (
                          <div key={k.username} className={`p-3 rounded-lg flex items-center justify-between ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <div>
                              <p className={`font-medium text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{k.username}</p>
                              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Provider: {k.provider} {k.model ? `· Model: ${k.model}` : ''} · Key: {k.apiKey ? k.apiKey.substring(0, 6) + '...' : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveApiKey(k.username)}
                              className={`p-2 rounded-lg text-red-600 hover:bg-red-50 ${darkMode ? 'hover:bg-red-900/20' : ''}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                   placeholder="username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="demo123"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Login
              </button>
            </form>


          </div>
        </div>
      </div>
    );
  }

  const filteredConversations = conversations.filter(conv =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`flex h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed lg:static inset-y-0 left-0 z-30 lg:z-auto transition-transform duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0'
        } ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        } border-r ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex flex-col overflow-hidden`}
      >
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
            }`}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <p className={`p-4 text-sm text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No conversations yet
            </p>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setCurrentConversationId(conv.id)}
                className={`p-3 mx-2 my-1 rounded-lg cursor-pointer transition-colors group ${
                  currentConversationId === conv.id
                    ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-900'
                    : darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{conv.title}</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                    className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                      darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Admin entry point - visible only to admin accounts, but never secret */}
        {isAdmin && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={openAdminDashboard}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <ShieldCheck size={18} />
              Admin Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <Menu size={20} />
            </button>
            <h1 className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {aiConfig.name}'s Assistant
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <span className={`text-xs sm:text-sm mr-1 sm:mr-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {username}{isAdmin ? ' (admin)' : ''}
            </span>
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Settings size={18} />
            </button>
            <button
              onClick={handleLogout}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <MessageCircle size={48} className={darkMode ? 'text-gray-600' : 'text-gray-400'} />
              <p className={`mt-4 text-lg font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                No messages yet
              </p>
              <p className={`mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Start a conversation by typing a message below
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  {msg.image && (
                    <img src={msg.image} alt="attached" className="w-32 h-32 rounded-lg mb-2 object-cover" />
                  )}
                  <p className="text-sm break-words">{msg.content}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className={`text-xs ${msg.role === 'user' ? 'text-blue-100' : darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => handleCopyMessage(msg.content, index)}
                      className={`p-1 rounded transition-colors ${
                        msg.role === 'user' ? 'hover:bg-blue-500' : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      {copiedIndex === index ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className={`px-4 py-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={`border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4 sm:p-6`}>
          {imageEditMode && (
            <div className={`mb-4 p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <h4 className={`font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Edit Image</h4>
              <input
                ref={imageEditInputRef}
                type="file"
                onChange={handleImageEditUpload}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
              {editImagePreview && (
                <img src={editImagePreview} alt="edit preview" className="w-32 h-32 rounded-lg mb-3 object-cover" />
              )}
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Describe how you want to edit this image..."
                className={`w-full px-3 py-2 rounded-lg border mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  darkMode ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-900'
                }`}
                rows="2"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => imageEditInputRef.current?.click()}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
                >
                  Upload Image
                </button>
                <button
                  onClick={() => { setImageEditMode(false); setEditPrompt(''); setEditImagePreview(null); setEditImageFile(null); }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
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
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                >
                  Add to Chat
                </button>
              </div>
            </div>
          )}

          {imagePreview && (
            <div className={`mb-3 p-3 rounded-lg flex items-center justify-between ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-3">
                <img src={imagePreview} alt="preview" className="w-10 h-10 rounded object-cover" />
                <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Image attached</span>
              </div>
              <button
                onClick={() => { setImagePreview(null); setAttachedImage(null); }}
                className={`p-1 rounded ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors`}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-1 flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`p-3 rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Upload size={20} />
              </button>
              <button
                onClick={() => setImageEditMode(!imageEditMode)}
                className={`p-3 rounded-lg transition-colors ${
                  darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                } ${imageEditMode ? (darkMode ? 'bg-gray-700' : 'bg-gray-100') : ''}`}
              >
                <Wand2 size={20} />
              </button>
            </div>

            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message... (Shift+Enter for new line)"
              className={`flex-1 px-4 py-3 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              rows="1"
              style={{ maxHeight: '120px' }}
            />

            <button
              onClick={handleSendMessage}
              disabled={(!inputValue.trim() && !attachedImage) || isLoading}
              className={`p-3 rounded-lg transition-colors ${
                (!inputValue.trim() && !attachedImage) || isLoading
                  ? darkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-none sm:rounded-2xl max-w-2xl w-full max-h-screen sm:max-h-[90vh] overflow-y-auto`}>
            <div className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 bg-inherit`}>
              <h2 className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className={`p-1 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* API Configuration - read-only for everyone, admins edit it from the Admin Dashboard */}
              <div>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <AlertCircle size={18} className="text-amber-500" />
                  API Provider
                </h3>
                <div className={`p-4 rounded-lg text-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                  <p>Provider: <strong>{apiConfig.provider}</strong></p>
                  <p>Model: <strong>{apiConfig.model || 'default'}</strong></p>
                  <p className="mt-2 text-xs opacity-75">
                    This is configured centrally by an administrator for all users.
                    {isAdmin && ' You can change it from the Admin Dashboard.'}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => { setShowSettings(false); openAdminDashboard(); }}
                    className="mt-3 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Open Admin Dashboard
                  </button>
                )}
              </div>

              {/* Change Password */}
              <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} pt-6`}>
                <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Change Password</h3>
                <div className="space-y-3">
                  {passwordError && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
                      {passwordSuccess}
                    </div>
                  )}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>New Password</label>
                    <input
                      type="password"
                      value={newPasswordUser}
                      onChange={(e) => setNewPasswordUser(e.target.value)}
                      placeholder="Enter new password"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Update Password
                  </button>
                </div>
              </div>

              {/* AI Identity */}
              <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} pt-6`}>
                <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>AI Identity</h3>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>AI Name</label>
                    <input
                      type="text"
                      value={editingConfig.name}
                      onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>System Prompt</label>
                    <textarea
                      value={editingConfig.systemPrompt}
                      onChange={(e) => setEditingConfig({ ...editingConfig, systemPrompt: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg border resize-none ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      rows="4"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Personality</label>
                    <select
                      value={editingConfig.personality}
                      onChange={(e) => setEditingConfig({ ...editingConfig, personality: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    >
                      <option>professional and friendly</option>
                      <option>creative and playful</option>
                      <option>formal and precise</option>
                      <option>casual and conversational</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Appearance */}
              <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} pt-6`}>
                <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Appearance</h3>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} transition-colors`}
                >
                  <span className={darkMode ? 'text-white' : 'text-gray-900'}>Dark Mode</span>
                  <div className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-400'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : ''}`}></div>
                  </div>
                </button>
              </div>

              <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} pt-6`}>
                <button
                  onClick={handleSaveConfig}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Save All Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Dashboard Modal - only ever reachable for role === 'admin' */}
      {isAdmin && showAdminDashboard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-none sm:rounded-2xl max-w-3xl w-full max-h-screen sm:max-h-[90vh] overflow-y-auto`}>
            <div className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 bg-inherit`}>
              <h2 className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                <ShieldCheck size={18} className="text-purple-500" />
                Admin Dashboard
              </h2>
              <button
                onClick={() => setShowAdminDashboard(false)}
                className={`p-1 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className={`flex border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} px-4 sm:px-6 overflow-x-auto`}>
              <button
                onClick={() => setAdminTab('config')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  adminTab === 'config'
                    ? 'border-purple-600 text-purple-600'
                    : `border-transparent ${darkMode ? 'text-gray-400' : 'text-gray-500'}`
                }`}
              >
                <KeyRound size={16} /> API Configuration
              </button>
              <button
                onClick={() => setAdminTab('users')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  adminTab === 'users'
                    ? 'border-purple-600 text-purple-600'
                    : `border-transparent ${darkMode ? 'text-gray-400' : 'text-gray-500'}`
                }`}
              >
                <Users size={16} /> Users
              </button>
              <button
                onClick={() => { setAdminTab('api-keys'); loadUserApiKeys(); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  adminTab === 'api-keys'
                    ? 'border-purple-600 text-purple-600'
                    : `border-transparent ${darkMode ? 'text-gray-400' : 'text-gray-500'}`
                }`}
              >
                <KeyRound size={16} /> API Keys
              </button>
              <button
                onClick={() => setAdminTab('activity')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  adminTab === 'activity'
                    ? 'border-purple-600 text-purple-600'
                    : `border-transparent ${darkMode ? 'text-gray-400' : 'text-gray-500'}`
                }`}
              >
                <Users size={16} /> User Activity
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {adminTab === 'config' && (
                <div className="space-y-4">
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    This is the single, shared API configuration. Saving here updates it for
                    every user immediately — there's nothing else to sync.
                  </p>

                  {adminConfigMeta?.updatedAt && (
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Last updated {new Date(adminConfigMeta.updatedAt).toLocaleString()}
                      {adminConfigMeta.updatedBy ? ` by ${adminConfigMeta.updatedBy}` : ''}
                    </p>
                  )}

                  {adminConfigError && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                      {adminConfigError}
                    </div>
                  )}
                  {adminConfigSuccess && (
                    <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
                      {adminConfigSuccess}
                    </div>
                  )}

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>API Provider</label>
                    <select
                      value={adminApiConfig.provider}
                      onChange={(e) => setAdminApiConfig({ ...adminApiConfig, provider: e.target.value, model: '' })}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                    >
                      {availableProviders.map(provider => (
                        <option key={provider.id} value={provider.id}>{provider.name}</option>
                      ))}
                    </select>
                  </div>

                  {adminApiConfig.provider === 'custom' && (
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Custom Endpoint URL</label>
                        <input
                          type="text"
                          value={adminApiConfig.customEndpoint}
                          onChange={(e) => setAdminApiConfig({ ...adminApiConfig, customEndpoint: e.target.value })}
                          placeholder="https://your-api.com/v1/chat/completions"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Custom Headers (JSON, optional)</label>
                        <textarea
                          value={adminApiConfig.customHeaders}
                          onChange={(e) => setAdminApiConfig({ ...adminApiConfig, customHeaders: e.target.value })}
                          placeholder='{"X-Custom-Header": "value"}'
                          className={`w-full px-4 py-2 rounded-lg border resize-none ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                          rows="3"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>API Key</label>
                    <input
                      type="password"
                      value={adminApiConfig.apiKey}
                      onChange={(e) => setAdminApiConfig({ ...adminApiConfig, apiKey: e.target.value })}
                      placeholder="Enter the provider's API key"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Model (optional)</label>
                    <input
                      type="text"
                      value={adminApiConfig.model}
                      onChange={(e) => setAdminApiConfig({ ...adminApiConfig, model: e.target.value })}
                      placeholder="e.g., claude-sonnet-4-6, gpt-4-turbo"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                    />
                  </div>

                  <button
                    onClick={handleSaveAdminConfig}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Save &amp; Apply to All Users
                  </button>
                </div>
              )}

              {adminTab === 'activity' && (
                <div className="space-y-4">
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Messages, images, and password changes users have made through this app. This log is why every
                    user sees the review notice above the chat window.
                  </p>

                  <div className="flex gap-2">
                    <select
                      value={activityFilter}
                      onChange={(e) => { setActivityFilter(e.target.value); loadActivity(e.target.value); }}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">All users</option>
                      {adminUsers.map(u => (
                        <option key={u.username} value={u.username}>{u.username} ({u.role})</option>
                      ))}
                    </select>
                    <button
                      onClick={() => loadActivity()}
                      className={`px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto space-y-2">
                    {activityLoading ? (
                      <p className={`text-sm text-center py-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
                    ) : activityEntries.length === 0 ? (
                      <p className={`text-sm text-center py-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No activity yet</p>
                    ) : (
                      activityEntries.map(entry => (
                        <div
                          key={entry.id}
                          className={`p-3 rounded-lg text-sm ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                              {entry.username} · {entry.type === 'user_message' ? 'sent' : entry.type === 'password_change' ? 'changed password' : 'AI reply'}
                            </span>
                            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {entry.image && (
                            <img src={entry.image} alt="uploaded" className="w-20 h-20 rounded object-cover mb-2" />
                          )}
                          <p className={`break-words ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {entry.content || (entry.hasImage ? '(image only)' : '')}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {adminTab === 'users' && (
                <div className="space-y-4">
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Create and manage user accounts. All users will use the same global API configuration.
                  </p>

                  {userError && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                      {userError}
                    </div>
                  )}
                  {userSuccess && (
                    <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
                      {userSuccess}
                    </div>
                  )}

                  <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                    <h4 className={`font-medium text-sm mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      Create New User
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Username</label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Enter username"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Password</label>
                        <input
                          type="text"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter password"
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Role</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value)}
                          className={`w-full px-4 py-2 rounded-lg border ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <button
                        onClick={async () => {
                          setUserError('');
                          setUserSuccess('');
                          try {
                            const response = await fetch(`${API_BASE_URL}/admin/users`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...authHeader() },
                              body: JSON.stringify({ username: newUsername, password: newPassword, role: newUserRole }),
                            });
                            const data = await response.json();
                            if (response.ok) {
                              setUserSuccess('User created successfully');
                              setNewUsername('');
                              setNewPassword('');
                              setNewUserRole('user');
                              loadAdminUsers();
                            } else {
                              setUserError(data.error || 'Failed to create user');
                            }
                          } catch (err) {
                            setUserError('Error creating user: ' + err.message);
                          }
                        }}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Create User
                      </button>
                    </div>
                  </div>

                   <div>
                     <h4 className={`font-medium text-sm mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                       Existing Users
                     </h4>
                     <div className="max-h-[300px] overflow-y-auto space-y-2">
                       {adminUsers.length === 0 ? (
                         <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No users found</p>
                       ) : (
                         adminUsers.map(u => (
                           <div key={u.username} className={`p-3 rounded-lg flex items-center justify-between ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                             <div className="flex-1 min-w-0 mr-3">
                               <p className={`font-medium text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{u.username}</p>
                               <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Password: {u.password || '••••••'}</p>
                             </div>
                             {u.username !== 'admin' && u.username !== 'demo' && (
                               <button
                                 onClick={async () => {
                                   if (!confirm('Are you sure you want to delete this user?')) return;
                                   try {
                                     const response = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(u.username)}`, {
                                       method: 'DELETE',
                                       headers: authHeader(),
                                     });
                                     if (response.ok) {
                                       setUserSuccess('User deleted successfully');
                                       loadAdminUsers();
                                     } else {
                                         const data = await response.json();
                                         setUserError(data.error || 'Failed to delete user');
                                     }
                                   } catch (err) {
                                     setUserError('Error deleting user: ' + err.message);
                                   }
                                 }}
                                 className={`p-2 rounded-lg text-red-600 hover:bg-red-50 ${darkMode ? 'hover:bg-red-900/20' : ''}`}
                               >
                                 <Trash2 size={16} />
                               </button>
                             )}
                           </div>
                         ))
                       )}
                     </div>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
