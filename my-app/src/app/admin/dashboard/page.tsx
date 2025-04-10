'use client';

import { useState, useEffect } from 'react';
import { parseCookies, destroyCookie } from 'nookies';
import axios from 'axios';

// Defina o tipo para os administradores
interface Admin {
  id: string;
  email: string;
  password: string;
}

const DashboardPage = () => {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  // Atualize o estado com o tipo correto
  const [admins, setAdmins] = useState<Admin[]>([]);

  useEffect(() => {
    const validateAuth = async () => {
      const { auth_token } = parseCookies();

      if (!auth_token) {
        window.location.href = '/admin';
        return;
      }

      try {
        // await axios.get('https://api-contra-cheque-online.vercel.app/validate-token', {
        //   headers: {
        //     Authorization: `Bearer ${auth_token}`,
        //   },
        // });
      } catch (err) {
        destroyCookie(null, 'auth_token');
        window.location.href = '/admin';
      }
    };

    validateAuth();
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
    setLoading(true);

    if (!year || !month || !file) {
      setError('Todos os campos são obrigatórios.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('year', year);
    formData.append('month', month);
    formData.append('file', file);

    try {
      const { auth_token } = parseCookies();

      await axios.post('https://api-contra-cheque-online.vercel.app/upload/payroll', formData, {
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
      setLoading(false);
    }
  };

  const handleLogout = () => {
    destroyCookie(null, 'auth_token');
    window.location.href = '/admin';
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-100 text-black">
      <header className="w-full bg-blue-600 text-white py-4 px-6 flex justify-between items-center fixed top-0 left-0">
        <h1 className="text-xl font-bold">Painel Administrativo - Upload de Contra-Cheque</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
        >
          Sair
        </button>
      </header>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md mt-20">
        <h1 className="text-2xl font-bold mb-6 text-center">Upload de Contra-Cheque</h1>
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">{success}</div>}
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
            {loading ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DashboardPage;
