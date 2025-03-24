'use client';

import { useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  interface authResponse {
    token: string;
  }

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
        // Implementando a lógica de autenticação com axios apontando para localhost:3001
        const response = await axios.post <authResponse>('http://localhost:3001/login/admin', {
          email,
          password
        });
        console.log(response.data);
        // Se a autenticação for bem-sucedida
        if (response.data && response.status === 200) {
          // Armazenar o token com o prefixo Bearer (se já não vier com ele)
          const token = response.data.token.startsWith('Bearer ') 
            ? response.data.token 
            : `Bearer ${response.data.token}`;
          
          localStorage.setItem('adminToken', token);
          
          // Redirecionar após login bem-sucedido
          window.location.href = '/master/dashboard';
          console.log(token);

        }
    } catch (err) {
        setError('Falha na autenticação. Verifique suas credenciais.');
        console.error(err);
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
