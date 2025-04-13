'use client';

import { useState, useEffect } from 'react';
import { parseCookies, destroyCookie } from 'nookies';
import axios from 'axios';
import {
  FILE_SIZE_THRESHOLD,
  isLargeFile,
  getPresignedUrl,
  uploadToS3,
  initiateS3Processing,
  checkJobStatus,
  uploadPayrollFile,
  JobStatusResponse,
} from '@/utils/s3Upload';

// Defina o tipo para os administradores
interface Admin {
  id: string;
  email: string;
  password: string;
}

const DashboardPage = () => {
  // Mover a declaração de useState para dentro do componente
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [showDeleteMode, setShowDeleteMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState(''); // Nova mensagem de ação
  
  // Estados para o processamento do upload
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [processResult, setProcessResult] = useState<object | null>(null);

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
        // await axios.get('https://api-contra-cheque-online.vercel.app/validate-token', {
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

  // Efeito para verificar o status do job periodicamente
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (jobId && jobStatus !== 'completed' && jobStatus !== 'failed') {
      interval = setInterval(checkJobStatusPeriodically, 2000); // Verifica a cada 2 segundos
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId, jobStatus]);

  // Função para verificar o status do job
  const checkJobStatusPeriodically = async () => {
    if (!jobId) return;
    
    try {
      const { auth_token } = parseCookies();
      const jobStatusResponse = await checkJobStatus(jobId, auth_token);
      
      const { status, progress, result } = jobStatusResponse;
      setJobStatus(status);
      setProgress(progress);
      
      if (status === 'completed') {
        setProcessResult(result);
        setSuccess('Arquivo processado com sucesso!');
        setLoading(false);
      } else if (status === 'failed') {
        setError('Falha no processamento do arquivo.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Erro ao verificar status do job:', err);
      setError('Erro ao verificar status do processamento.');
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const { auth_token } = parseCookies();
        const response = await axios.get <any>('https://api-contra-cheque-online.vercel.app/master', {
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
    setSuccess('');
    setError('');
    setJobId(null);
    setJobStatus(null);
    setProgress(0);
    setProcessResult(null);

    if (!year || !month || !file) {
      setError('Todos os campos são obrigatórios.');
      setLoading(false); // Finaliza o estado de carregamento
      return;
    }

    try {
      const { auth_token } = parseCookies();

      // Verifica se o arquivo é grande (maior que 4MB)
      if (isLargeFile(file)) {
        // 1. Obter URL pré-assinada para upload
        const presignedUrlResponse = await getPresignedUrl(year, month, file.type, auth_token);
        const { uploadUrl, fileKey } = presignedUrlResponse;

        // 2. Fazer upload direto para o S3
        const uploadSuccess = await uploadToS3(uploadUrl, file);
        if (!uploadSuccess) {
          setError('Erro ao enviar o arquivo para o servidor de armazenamento.');
          setLoading(false);
          return;
        }

        // 3. Iniciar processamento do arquivo
        const newJobId = await initiateS3Processing(fileKey, year, month, auth_token);
        if (newJobId) {
          setJobId(newJobId);
          setJobStatus('processing');
          setSuccess('Arquivo enviado com sucesso! Processando...');
        } else {
          setError('Erro ao iniciar o processamento do arquivo.');
          setLoading(false);
        }
      } else {
        // Para arquivos pequenos, continua usando o método original
        const uploadSuccess = await uploadPayrollFile(year, month, file, auth_token);
        
        if (uploadSuccess) {
          setSuccess('Arquivo enviado com sucesso!');
          setError('');
          setYear('');
          setMonth('');
          setFile(null);
        } else {
          setError('Erro ao enviar o arquivo.');
        }
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar o arquivo.');
      setSuccess('');
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      const { auth_token } = parseCookies();
      await axios.post(
        'https://api-contra-cheque-online.vercel.app/master',
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
      const response = await axios.get <any>('https://api-contra-cheque-online.vercel.app/master', {
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
          axios.delete(`https://api-contra-cheque-online.vercel.app/master/${id}`, {
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
      const response = await axios.get <any>('https://api-contra-cheque-online.vercel.app/master', {
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

  // Renderizar a barra de progresso
  const renderProgressBar = () => {
    if (!jobId || !jobStatus) return null;
    
    return (
      <div className="mt-4">
        <div className="mb-2 flex justify-between">
          <span className="text-sm font-medium">Processando...</span>
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    );
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

      <div className="container mx-auto mt-20 p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload de Contra-Cheque */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6">Upload de Contra-Cheque</h2>
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">{success}</div>}
          {renderProgressBar()}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="year" className="block text-sm font-medium mb-2">
                Ano
              </label>
              <input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Digite o ano"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="month" className="block text-sm font-medium mb-2">
                Mês
              </label>
              <input
                id="month"
                type="number"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="Digite o mês"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="file" className="block text-sm font-medium mb-2">
                Arquivo PDF
              </label>
              <input
                id="file"
                type="file"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                accept="application/pdf"
                required
              />
              {file && isLargeFile(file) && (
                <p className="mt-1 text-xs text-blue-600">
                  Arquivo grande detectado. Será feito upload direto para armazenamento seguro.
                </p>
              )}
            </div>
            <button
              type="submit"
              className={`w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <svg
                  className="animate-spin h-5 w-5 text-white mr-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : null}
              {loading && !jobId ? 'Enviando...' : loading && jobId ? 'Processando...' : 'Enviar'}
            </button>
          </form>
          
          {processResult && (
            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <h3 className="font-medium text-blue-800 mb-2">Resultado do processamento:</h3>
              <pre className="text-xs overflow-auto max-h-40 p-2 bg-white rounded border border-blue-200">
                {JSON.stringify(processResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6 text-center">Lista de Admins</h2>
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
