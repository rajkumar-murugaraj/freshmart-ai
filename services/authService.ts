import { User } from '../types';

const USERS_KEY = 'freshmart_users';
const SESSION_KEY = 'freshmart_session';

// Helper to get all users
const getUsers = (): User[] => {
  const users = localStorage.getItem(USERS_KEY);
  return users ? JSON.parse(users) : [];
};

// Helper to save all users
const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const authService = {
  login: (email: string, password: string): User | null => {
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return user;
    }
    return null;
  },

  register: (name: string, email: string, password: string, phone: string): User => {
    const users = getUsers();
    if (users.find(u => u.email === email)) {
      throw new Error("User already exists");
    }
    
    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      password,
      role: 'user',
      phone,
      addresses: [],
      orders: []
    };
    
    users.push(newUser);
    saveUsers(users);
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    return newUser;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  getCurrentUser: (): User | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  updateUser: (updatedUser: User) => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      saveUsers(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser)); // Update session too
    }
  }
};
