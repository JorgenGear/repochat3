import { useApp } from './context/AppContext';
import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Add LoadingSpinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
  </div>
);

// Add ContextSelector component
const ContextSelector = ({ repositories, selectedRepos, toggleRepositorySelection, onClose }) => (
  <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-80">
    <div className="p-4 border-b border-gray-200">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-800">Select Context</h3>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      {selectedRepos.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {repositories
              .filter(repo => selectedRepos.includes(repo.id))
              .map(repo => (
                <span 
                  key={repo.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-700"
                >
                  <span>{repo.name}</span>
                  <button
                    onClick={() => toggleRepositorySelection(repo.id)}
                    className="ml-1 hover:text-blue-900"
                  >
                    ✕
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
    <div className="max-h-60 overflow-y-auto p-2">
      {repositories.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          No repositories available
        </div>
      ) : (
        repositories.map(repo => (
          <div 
            key={repo.id} 
            className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
            onClick={() => toggleRepositorySelection(repo.id)}
          >
            <input 
              type="checkbox" 
              checked={selectedRepos.includes(repo.id)}
              onChange={() => {}}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div className="ml-3 flex-1">
              <div className="font-medium text-gray-800">{repo.name}</div>
              <div className="text-xs text-gray-500">
                {repo.files.length} {repo.files.length === 1 ? 'file' : 'files'}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// Update Toast component to use a portal or fixed positioning
const Toast = ({ message, type, onClose }) => (
  <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white flex items-center space-x-2 animate-fade-in ${
    type === 'success' ? 'bg-green-500' : 'bg-red-500'
  }`}>
    <span>{type === 'success' ? '✓' : '✕'}</span>
    <span>{message}</span>
    <button 
      onClick={onClose}
      className="ml-4 text-white hover:text-gray-200"
    >
      ✕
    </button>
  </div>
);

// Main Application Component
const ChatbotApp = () => {
  const {
    isAuthenticated,
    currentView,
    setCurrentView,
    selectedChat,
    setSelectedChat,
    selectedRepos,
    repositories,
    chats,
    messages,
    settings,
    createNewChat,
    sendMessage,
    createRepository,
    deleteRepository,
    addFileToRepository,
    deleteFileFromRepository,
    toggleRepositorySelection,
    updateSettings,
    login,
    logout,
  } = useApp();

  const [newMessage, setNewMessage] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRepoForUpload, setSelectedRepoForUpload] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [isSending, setIsSending] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [toast, setToast] = useState(null);
  const contextMenuRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add useEffect for toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSendMessage = async (e) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!newMessage.trim() || isSending) return;
    
    if (!settings.apiKey) {
      setToast({
        message: 'Please set your API key in settings first',
        type: 'error'
      });
      return;
    }

    try {
      setIsSending(true);
      setIsThinking(true);
      
      let currentChatId = selectedChat;
      
      // If no chat is selected, create a new one
      if (!currentChatId) {
        const newChat = await createNewChat();
        if (!newChat?.id) {
          throw new Error('Failed to create new chat');
        }
        currentChatId = newChat.id;
        setSelectedChat(currentChatId);
      }
      
      // Send the message
      await sendMessage({
        chatId: currentChatId,
        content: newMessage.trim(),
        repositories: repositories
      });
      
      // Clear the input after successful send
      setNewMessage('');
      
      // Show success message
      setToast({
        message: 'Message sent successfully',
        type: 'success'
      });
      
      // Scroll to bottom after message is sent
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setToast({
        message: error.message || 'Failed to send message. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSending(false);
      setIsThinking(false);
    }
  };

  // Add useEffect to log message changes
  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

  // Add useEffect to log selected chat changes
  useEffect(() => {
    console.log('Selected chat changed:', selectedChat);
  }, [selectedChat]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !selectedRepoForUpload) return;

    const newFiles = await Promise.all(files.map(async (file) => {
      let content = '';
      
      if (file.type === 'application/pdf') {
        try {
          // For PDFs, use pdf.js
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
          let textContent = '';
          
          // Extract text from each page
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            textContent += pageText + '\n';
          }
          
          content = textContent;
        } catch (error) {
          console.error('PDF processing error:', error);
          content = '[Error processing PDF content]';
        }
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          // For Word documents, use mammoth
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
        } catch (error) {
          console.error('Word document processing error:', error);
          content = '[Error processing Word document content]';
        }
      } else if (file.type === 'application/msword') {
        // For older .doc files, we'll need to handle them differently
        content = '[Old Word document format (.doc) not supported. Please convert to .docx]';
      } else if (file.type.startsWith('text/') || 
                 file.type === 'application/json' || 
                 file.type === 'application/javascript' || 
                 file.type === 'application/xml') {
        // For text-based files, read as text
        content = await file.text();
      } else {
        // For other file types, try to read as text
        try {
          content = await file.text();
        } catch (error) {
          console.error('File processing error:', error);
          content = `[Error processing ${file.type} content]`;
        }
      }

      return {
        name: file.name,
        content,
        type: file.type,
        size: file.size,
      };
    }));

    newFiles.forEach(file => {
      addFileToRepository(selectedRepoForUpload, file);
    });

    setUploadedFiles([...uploadedFiles, ...newFiles]);
    fileInputRef.current.value = '';
  };

  const handleCreateRepository = (e) => {
    e.preventDefault();
    if (newRepoName.trim()) {
      createRepository(newRepoName);
      setNewRepoName('');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    login(loginData.email, loginData.password);
  };

  const handleCreateNewChat = async () => {
    try {
      const result = await createNewChat();
      if (!result || !result.id) {
        throw new Error('Failed to create new chat');
      }
      setSelectedChat(result.id);
      setNewMessage('');
    } catch (error) {
      console.error('Error creating new chat:', error);
      setToast({
        message: 'Failed to create new chat. Please try again.',
        type: 'error'
      });
    }
  };

  return isAuthenticated ? (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 font-bold text-xl text-gray-800 border-b border-gray-200">AI Chat Assistant</div>
        
        {/* Navigation */}
        <nav className="p-2 space-y-1">
          <button 
            className={`w-full text-left p-3 rounded-lg flex items-center space-x-2 ${
              currentView === 'chat' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setCurrentView('chat')}
          >
            <span className="text-lg">💬</span>
            <span>Chats</span>
          </button>
          <button 
            className={`w-full text-left p-3 rounded-lg flex items-center space-x-2 ${
              currentView === 'repositories' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setCurrentView('repositories')}
          >
            <span className="text-lg">📁</span>
            <span>Repositories</span>
          </button>
          <button 
            className={`w-full text-left p-3 rounded-lg flex items-center space-x-2 ${
              currentView === 'settings' 
                ? 'bg-blue-50 text-blue-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setCurrentView('settings')}
          >
            <span className="text-lg">⚙️</span>
            <span>Settings</span>
          </button>
        </nav>
        
        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2">
          {currentView === 'chat' && (
            <>
              <button 
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 px-4 rounded-lg mb-3 transition-all duration-200"
                onClick={handleCreateNewChat}
              >
                + New Chat
              </button>
              <div className="space-y-2">
                {chats.map(chat => (
                  <div 
                    key={chat.id} 
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedChat === chat.id 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedChat(chat.id)}
                  >
                    <div className="font-medium text-gray-800">{chat.name || 'New Chat'}</div>
                    <div className="text-xs text-gray-500">{chat.timestamp}</div>
                  </div>
                ))}
                {chats.length === 0 && !isLoading && (
                  <div className="text-center text-gray-500 py-4">
                    No chats yet. Start a new conversation!
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* User profile section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                U
              </div>
              <div className="ml-3">
                <div className="font-medium text-gray-800">User Name</div>
                <div className="text-xs text-gray-500">user@example.com</div>
              </div>
            </div>
            <button 
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Content Header */}
        <div className="bg-white p-4 shadow-sm flex justify-between items-center">
          {currentView === 'chat' && (
            <>
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-gray-800">
                  {chats.find(c => c.id === selectedChat)?.name || 'New Chat'}
                </h1>
                <div className="relative">
                  <button 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-2 ${
                      selectedRepos.length > 0 
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    onClick={() => setShowContextMenu(!showContextMenu)}
                  >
                    <span>
                      {selectedRepos.length > 0 
                        ? `${selectedRepos.length} ${selectedRepos.length === 1 ? 'repository' : 'repositories'} selected` 
                        : 'Select Context'}
                    </span>
                    <span className="text-xs">▼</span>
                  </button>
                  {showContextMenu && (
                    <div className="absolute left-0 top-full mt-1">
                      <ContextSelector 
                        repositories={repositories}
                        selectedRepos={selectedRepos}
                        toggleRepositorySelection={toggleRepositorySelection}
                        onClose={() => setShowContextMenu(false)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          
          {currentView === 'repositories' && (
            <h1 className="text-xl font-bold text-gray-800">Repositories</h1>
          )}
          
          {currentView === 'settings' && (
            <h1 className="text-xl font-bold text-gray-800">Settings</h1>
          )}
        </div>
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4">
          {currentView === 'chat' && (
            <div className="flex-1 flex flex-col h-full">
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {selectedChat ? chats.find(c => c.id === selectedChat)?.name : 'Select a chat'}
                  </h2>
                  <button
                    onClick={handleCreateNewChat}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    New Chat
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                <div className="max-w-3xl mx-auto space-y-4">
                  {selectedChat && messages && messages[selectedChat] ? (
                    messages[selectedChat].map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white border border-gray-200'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          <div className="text-xs opacity-75 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500">
                      {selectedChat ? 'No messages yet. Start the conversation!' : 'Select a chat to view messages'}
                    </div>
                  )}
                  {isThinking && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message Input - Pinned to bottom */}
              <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0">
                <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isSending}
                    />
                    <button
                      type="submit"
                      disabled={isSending || !newMessage.trim() || !settings.apiKey}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        isSending || !newMessage.trim() || !settings.apiKey
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {isSending ? <LoadingSpinner /> : 'Send'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          
          {currentView === 'repositories' && (
            <div className="bg-white rounded-lg shadow-sm p-6 max-w-3xl mx-auto">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Repository Files</h2>
              
              {/* Repository creation form */}
              <form onSubmit={handleCreateRepository} className="mb-6">
                <div className="flex">
                  <input
                    type="text"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder="New repository name"
                    className="flex-1 p-2 rounded-l-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button 
                    type="submit"
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-2 px-4 rounded-r-lg transition-all duration-200"
                  >
                    Create Repository
                  </button>
                </div>
              </form>
              
              {/* Repository selection for upload */}
              <div className="mb-4">
                <label className="block mb-2 font-medium text-gray-700">Select Repository for Upload</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={selectedRepoForUpload || ''}
                  onChange={(e) => setSelectedRepoForUpload(Number(e.target.value))}
                >
                  <option value="">Select a repository</option>
                  {repositories.map(repo => (
                    <option key={repo.id} value={repo.id}>{repo.name}</option>
                  ))}
                </select>
              </div>
              
              {/* File upload area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer"
                >
                  <p className="mb-2 text-gray-600">Drag files here or click to upload</p>
                  <button 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 px-4 rounded-lg transition-all duration-200"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse Files
                  </button>
                </label>
              </div>
              
              {/* Repository list with files */}
              <div className="space-y-4">
                {repositories.map(repo => (
                  <div key={repo.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <div className="font-medium text-gray-800">{repo.name}</div>
                        <div className="text-xs text-gray-500">{repo.files.length} files</div>
                      </div>
                      <button 
                        className="text-red-500 hover:text-red-600 transition-colors duration-200"
                        onClick={() => deleteRepository(repo.id)}
                      >
                        Delete Repository
                      </button>
                    </div>
                    
                    {/* Files in repository */}
                    {repo.files.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {repo.files.map(file => (
                          <div key={file.id} className="flex justify-between items-center p-2 bg-white rounded">
                            <div>
                              <div className="font-medium text-gray-800">{file.name}</div>
                              <div className="text-xs text-gray-500">
                                {Math.round(file.size / 1024)} KB • {new Date(file.lastModified).toLocaleDateString()}
                              </div>
                            </div>
                            <button 
                              className="text-red-500 hover:text-red-600 transition-colors duration-200"
                              onClick={() => deleteFileFromRepository(repo.id, file.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Settings View */}
          {currentView === 'settings' && (
            <div className="p-6">
              <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      OpenAI API Key
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="password"
                        value={settings.apiKey}
                        onChange={(e) => updateSettings({ ...settings, apiKey: e.target.value })}
                        placeholder="Enter your OpenAI API key"
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={() => {
                          if (!settings.apiKey) {
                            setToast({
                              message: 'Please enter an API key',
                              type: 'error'
                            });
                            return;
                          }
                          if (!settings.apiKey.startsWith('sk-') || settings.apiKey.length < 20) {
                            setToast({
                              message: 'Invalid API key format. It should start with "sk-" and be at least 20 characters long.',
                              type: 'error'
                            });
                            return;
                          }
                          setToast({
                            message: 'API key saved successfully',
                            type: 'success'
                          });
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Your API key should start with "sk-" and be at least 20 characters long.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AI Provider
                    </label>
                    <select
                      value={settings.aiProvider}
                      onChange={(e) => updateSettings({ ...settings, aiProvider: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="OpenAI">OpenAI</option>
                      <option value="Anthropic">Anthropic</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Add Toast at the root level */}
          {toast && (
            <Toast 
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Login to AI Chat Assistant</h1>
        
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block mb-2 font-medium text-gray-700">Email</label>
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
            />
          </div>
          
          <div className="mb-6">
            <label className="block mb-2 font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              placeholder="Enter your password" 
              className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
            />
          </div>
          
          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 px-4 rounded-lg mb-4 transition-all duration-200"
          >
            Sign In
          </button>
          
          <div className="text-center text-sm text-gray-600">
            Don't have an account? <a href="#" className="text-blue-600 hover:text-blue-700">Sign up</a>
          </div>
        </form>
        
        {/* Add Toast for login page as well */}
        {toast && (
          <Toast 
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
};

// Add this to your CSS (you can add it inline in the Toast component or in your stylesheet)
const styles = {
  '@keyframes fadeIn': {
    from: {
      opacity: 0,
      transform: 'translateY(10px)'
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)'
    }
  },
  '.animate-fade-in': {
    animation: 'fadeIn 0.3s ease-out'
  }
};

export default ChatbotApp; 