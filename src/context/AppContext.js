import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('chat');
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState({});
  const [settings, setSettings] = useState({
    aiProvider: 'OpenAI',
    apiKey: '',
  });

  // Load data from localStorage on initial load
  useEffect(() => {
    const savedRepos = localStorage.getItem('repositories');
    const savedChats = localStorage.getItem('chats');
    const savedMessages = localStorage.getItem('messages');
    const savedSettings = localStorage.getItem('settings');
    const savedAuth = localStorage.getItem('isAuthenticated');
    const savedSelectedRepos = localStorage.getItem('selectedRepos');

    if (savedRepos) setRepositories(JSON.parse(savedRepos));
    if (savedChats) setChats(JSON.parse(savedChats));
    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    if (savedAuth) setIsAuthenticated(JSON.parse(savedAuth));
    if (savedSelectedRepos) setSelectedRepos(JSON.parse(savedSelectedRepos));
  }, []);

  // Save data to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('repositories', JSON.stringify(repositories));
  }, [repositories]);

  useEffect(() => {
    localStorage.setItem('chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem('messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('selectedRepos', JSON.stringify(selectedRepos));
  }, [selectedRepos]);

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      name: 'New Chat',
      timestamp: new Date().toISOString()
    };
    
    // Initialize messages for the new chat
    setMessages(prev => ({
      ...prev,
      [newChat.id]: []
    }));
    
    // Add the new chat to the list
    setChats(prev => [...prev, newChat]);
    
    // Set as selected chat
    setSelectedChat(newChat.id);
    
    return newChat;
  };

  const sendMessage = async ({ chatId, content, repositories }) => {
    if (!chatId || !content) return;

    try {
      // Check if repositories are selected
      if (!selectedRepos || selectedRepos.length === 0) {
        throw new Error('Please select at least one repository as context before sending a message');
      }

      // Check if this is a new chat or continuing an existing one
      const existingMessages = messages[chatId] || [];
      if (existingMessages.length > 0) {
        // For existing chats, verify the selected repositories match the initial selection
        const initialRepos = existingMessages[0].repositories || [];
        const hasChanged = !initialRepos.every(repo => selectedRepos.includes(repo)) ||
                         !selectedRepos.every(repo => initialRepos.includes(repo));
        
        if (hasChanged) {
          throw new Error('Cannot change repository context once a chat has started. Please start a new chat to use different repositories.');
        }
      }

      // Add user message with repository context
      const userMessage = {
        id: Date.now(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        repositories: [...selectedRepos]
      };

      setMessages(prev => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), userMessage]
      }));

      // Prepare chat history for context (limit to last 5 messages)
      const chatHistory = messages[chatId] || [];
      const recentHistory = chatHistory.slice(-5); // Only keep last 5 messages
      const formattedHistory = recentHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Prepare repository context from selected repositories
      const selectedRepositories = repositories.filter(repo => selectedRepos.includes(repo.id));
      
      // Limit the amount of context from each repository and sanitize content
      const limitedRepositoryContext = selectedRepositories.map(repo => {
        // Take only the first 1000 characters from each file and remove any sensitive data
        const limitedFiles = repo.files.map(file => {
          let sanitizedContent = '';
          
          // Handle different file types
          if (file.type === 'application/pdf') {
            // PDF content is already extracted text
            sanitizedContent = file.content
              .substring(0, 1000)
              .replace(/sk-[a-zA-Z0-9]+/g, '[API_KEY]')
              .replace(/[a-zA-Z0-9]{32,}/g, '[HASH]');
          } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // Word document content is already extracted text
            sanitizedContent = file.content
              .substring(0, 1000)
              .replace(/sk-[a-zA-Z0-9]+/g, '[API_KEY]')
              .replace(/[a-zA-Z0-9]{32,}/g, '[HASH]');
          } else if (file.type === 'application/msword') {
            // Old Word format message
            sanitizedContent = file.content;
          } else if (file.type.startsWith('text/') || 
                    file.type === 'application/json' || 
                    file.type === 'application/javascript' || 
                    file.type === 'application/xml') {
            // For text-based files, sanitize normally
            sanitizedContent = file.content
              .substring(0, 1000)
              .replace(/sk-[a-zA-Z0-9]+/g, '[API_KEY]')
              .replace(/[a-zA-Z0-9]{32,}/g, '[HASH]');
          } else {
            // For other file types, use the content as is
            sanitizedContent = file.content.substring(0, 1000);
          }
          
          return {
            name: file.name,
            type: file.type,
            content: sanitizedContent + (file.content.length > 1000 ? '...' : '')
          };
        });
        
        return {
          name: repo.name,
          files: limitedFiles
        };
      });

      const repositoryContext = `Context from selected repositories:\n${limitedRepositoryContext.map(repo => {
        const filesContent = repo.files.map(file => {
          let contentHeader = `File: ${file.name} (${file.type})\n`;
          if (file.type === 'application/pdf') {
            contentHeader += 'This is a PDF document. Here is the extracted text content:\n';
          }
          return contentHeader + `Content:\n${file.content}`;
        }).join('\n\n');
        return `Repository: ${repo.name}\n${filesContent}`;
      }).join('\n\n')}\n\n`;

      // Add a system message to help the AI understand the context
      const systemMessage = {
        role: 'system',
        content: 'You are a helpful assistant analyzing document content. When discussing PDF files, focus on the extracted text content. If the content appears to be binary or encoded, try to interpret any readable text and provide insights based on that. If the content is completely unreadable, acknowledge this and suggest referring to the original document.'
      };

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            systemMessage,
            ...formattedHistory,
            {
              role: 'user',
              content: repositoryContext + content
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error?.code === 'context_length_exceeded') {
          throw new Error('The selected repositories contain too much content. Please select fewer repositories or files with less content.');
        }
        throw new Error(errorData.error?.message || 'Failed to get response from OpenAI');
      }

      const data = await response.json();
      const aiMessage = {
        id: Date.now(),
        role: 'assistant',
        content: data.choices[0].message.content,
        timestamp: new Date().toISOString(),
        repositories: [...selectedRepos]
      };

      setMessages(prev => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), aiMessage]
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const createRepository = (name) => {
    const newRepo = {
      id: Date.now(),
      name,
      files: [],
    };
    setRepositories([...repositories, newRepo]);
  };

  const deleteRepository = (id) => {
    setRepositories(repositories.filter(repo => repo.id !== id));
    setSelectedRepos(selectedRepos.filter(repoId => repoId !== id));
  };

  const addFileToRepository = (repoId, file) => {
    setRepositories(repositories.map(repo => {
      if (repo.id === repoId) {
        return {
          ...repo,
          files: [...repo.files, {
            id: Date.now(),
            name: file.name,
            content: file.content,
            type: file.type,
            size: file.size,
            lastModified: new Date().toISOString(),
          }],
        };
      }
      return repo;
    }));
  };

  const deleteFileFromRepository = (repoId, fileId) => {
    setRepositories(repositories.map(repo => {
      if (repo.id === repoId) {
        return {
          ...repo,
          files: repo.files.filter(file => file.id !== fileId),
        };
      }
      return repo;
    }));
  };

  const toggleRepositorySelection = (id) => {
    setSelectedRepos(prev => 
      prev.includes(id) 
        ? prev.filter(repoId => repoId !== id)
        : [...prev, id]
    );
  };

  const updateSettings = (newSettings) => {
    setSettings({ ...settings, ...newSettings });
  };

  const login = (email, password) => {
    // In a real app, this would validate credentials with your auth service
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AppContext.Provider
      value={{
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}; 