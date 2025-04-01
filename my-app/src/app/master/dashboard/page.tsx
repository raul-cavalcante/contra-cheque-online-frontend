'use client';

import { useState, useEffect } from 'react';
import { parseCookies, destroyCookie } from 'nookies';
import axios from 'axios';

const DashboardPage = () => {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [showDeleteMode, setShowDeleteMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState(''); // Nova mensagem de ação

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    const validateAuth = async () => {
      const { auth_token } = parseCookies();

      if (!auth_token) {
        console.log('Token ausente. Redirecionando para /admin.');
        window.location.href = '/admin';
        return;
      }

      try {
        console.log('Validando token:', auth_token);
        // await axios.get('http://localhost:3001/validate-token', {
        //   headers: {
        //     Authorization: `Bearer ${auth_token}`,
        //   },
        // });
        console.log('Token válido.');
      } catch (err) {
        console.error('Erro ao validar o token:', err);
        destroyCookie(null, 'auth_token');
        window.location.href = '/admin';
      }
    };

    validateAuth();
  }, []);

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const { auth_token } = parseCookies();
        const response = await axios.get('http://localhost:3001/master', {
          headers: {
            Authorization: `Bearer ${auth_token}`,
          },
        });
        setAdmins(response.data);
      } catch (err) {
        console.error('Erro ao buscar admins:', err);
      }
    };

    fetchAdmins();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Apenas arquivos PDF são permitidos.');
        setFile(null);
      } else {
        setError('');
        setFile(selectedFile);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); // Inicia o estado de carregamento

    if (!year || !month || !file) {
      setError('Todos os campos são obrigatórios.');
      setLoading(false); // Finaliza o estado de carregamento
      return;
    }

    const formData = new FormData();
    formData.append('year', year);
    formData.append('month', month);
    formData.append('file', file);

    try {
      const { auth_token } = parseCookies();

      const response = await axios.post('http://localhost:3001/upload/payroll', formData, {
        headers: {
          Authorization: `Bearer ${auth_token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess('Arquivo enviado com sucesso!');
      setError('');
      setYear('');
      setMonth('');
      setFile(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar o arquivo.');
      setSuccess('');
    } finally {
      setLoading(false); // Finaliza o estado de carregamento
    }
  };

  const handleCreateAdmin = async () => {
    try {
      const { auth_token } = parseCookies();
      await axios.post(
        'http://localhost:3001/master',
        { email: newAdminEmail, password: newAdminPassword },
        {
          headers: {
            Authorization: `Bearer ${auth_token}`,
          },
        }
      );
      setShowCreateModal(false);
      setNewAdminEmail('');
      setNewAdminPassword('');
      setActionMessage('Admin criado com sucesso!');
      setTimeout(() => setActionMessage(''), 3000); // Remove a mensagem após 3 segundos
      // Atualiza a lista de admins
      const response = await axios.get('http://localhost:3001/master', {
        headers: {
          Authorization: `Bearer ${auth_token}`,
        },
      });
      setAdmins(response.data);
    } catch (err) {
      console.error('Erro ao criar admin:', err);
    }
  };

  const handleDeleteAdmins = async () => {
    try {
      const { auth_token } = parseCookies();
      await Promise.all(
        selectedAdmins.map((id) =>
          axios.delete(`http://localhost:3001/master/${id}`, {
            headers: {
              Authorization: `Bearer ${auth_token}`,
            },
          })
        )
      );
      setShowDeleteMode(false);
      setSelectedAdmins([]);
      setActionMessage('Admin(s) deletado(s) com sucesso!');
      setTimeout(() => setActionMessage(''), 3000); // Remove a mensagem após 3 segundos
      // Atualiza a lista de admins
      const response = await axios.get('http://localhost:3001/master', {
        headers: {
          Authorization: `Bearer ${auth_token}`,
        },
      });
      setAdmins(response.data);
    } catch (err) {
      console.error('Erro ao deletar admins:', err);
    }
  };

  const toggleAdminSelection = (id: string) => {
    setSelectedAdmins((prev) =>
      prev.includes(id) ? prev.filter((adminId) => adminId !== id) : [...prev, id]
    );
  };

  const handleLogout = () => {
    destroyCookie(null, 'auth_token');
    window.location.href = '/master';
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-100 text-black relative">
      <header className="w-full bg-blue-600 text-white py-6 px-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="md:hidden">
          <button
            onClick={toggleMenu}
            className="text-white focus:outline-none focus:ring-2 focus:ring-white"
          >
            ☰
          </button>
        </div>
        <nav className="hidden md:flex space-x-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            Criar Admin
          </button>
          <button
            onClick={() => setShowDeleteMode(!showDeleteMode)}
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            {showDeleteMode ? 'Cancelar' : 'Deletar Admins'}
          </button>
          <button
            onClick={handleLogout}
            className="border border-red-600 text-red-600 py-2 px-4 rounded-md hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Sair
          </button>
        </nav>
      </header>

      <div
        className={`md:hidden bg-blue-600 text-white w-full py-4 px-6 transform transition-transform duration-300 fixed top-0 left-0 z-50 ${
          isMenuOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ maxHeight: '100vh', overflow: 'hidden' }}
      >
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleMenu}
            className="text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-white"
          >
            ✕
          </button>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="block w-full text-left bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors mb-2"
        >
          Criar Admin
        </button>
        <button
          onClick={() => setShowDeleteMode(!showDeleteMode)}
          className="block w-full text-left bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors mb-2"
        >
          {showDeleteMode ? 'Cancelar' : 'Deletar Admins'}
        </button>
        <button
          onClick={handleLogout}
          className="block w-full text-left border border-red-600 text-red-600 py-2 px-4 rounded-md hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
        >
          Sair
        </button>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-2xl mt-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Lista de Admins</h1>
        {actionMessage && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
            {actionMessage}
          </div>
        )}
        <ul>
          {admins.map((admin: any) => (
            <li key={admin.id} className="mb-4">
              <div className="flex items-center justify-between">
                {showDeleteMode && (
                  <input
                    type="checkbox"
                    checked={selectedAdmins.includes(admin.id)}
                    onChange={() => toggleAdminSelection(admin.id)}
                    className="mr-2 w-5 h-5"
                  />
                )}
                <span>{admin.email}</span>
                <span>{admin.password}</span>
              </div>
              <hr className="mt-2 border-gray-300" />
            </li>
          ))}
        </ul>
        {showDeleteMode && (
          <button
            onClick={handleDeleteAdmins}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Deletar {selectedAdmins.length} Admin(s)
          </button>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4">
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm md:max-w-md">
            <h2 className="text-xl font-bold mb-4 text-center">Criar Admin</h2>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="bg-gray-300 text-black py-2 px-4 rounded-md mr-2 hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateAdmin}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
