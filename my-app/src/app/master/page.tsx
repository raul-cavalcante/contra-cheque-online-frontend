'use client';

import { useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { setCookie } from 'nookies';

interface authResponse {
  token: string;
  admin: {
    id: string;
    email: string;
    password: string;
    role: string;
    createdAt: string;
  };
}

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação básica
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Email inválido. Por favor, digite um email válido.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await axios.post<authResponse>('https://api-contra-cheque-online.vercel.app/login/admin', {
        email,
        password,
      });

      console.log('Resposta da API:', response.data); // Log para depuração

      if (response.data && response.data.token) {
        const { role } = response.data.admin;

        if (role !== 'master') {
          setError('Acesso negado. Apenas usuários com permissão de "master" podem acessar.');
          console.log('Role recebido:', role); // Log para depuração
          return;
        }

        setCookie(null, 'auth_token', response.data.token, {
          maxAge: 43200, // 12 horas em segundos
          path: '/',
          secure: true // Removido httpOnly
        });

        window.location.href = '/master/dashboard';
      } else {
        setError('Resposta inválida do servidor. Token não encontrado.');
      }
    } catch (err: any) {
      if (err.response) {
        setError(err.response.data.message || 'Falha na autenticação. Verifique suas credenciais.');
      } else if (err.request) {
        setError('Servidor indisponível. Tente novamente mais tarde.');
      } else {
        setError('Erro ao processar a solicitação.');
      }
      console.error('Erro na requisição:', err); // Log para depuração
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-black">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black">Área Administrativa</h1>
          <p className="text-black mt-2">Faça login para acessar o painel administrativo</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-black text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@exemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              disabled={loading}
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-black text-sm font-medium mb-2">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              disabled={loading}
              required
            />
          </div>

          <div className="mb-6 text-right">
            <Link href="/admin/recuperar-senha" className="text-sm text-blue-600 hover:underline">
              Esqueci minha senha
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-blue-300"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-black">
            <Link href="/" className="text-blue-600 hover:underline">
              Voltar para a página inicial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
