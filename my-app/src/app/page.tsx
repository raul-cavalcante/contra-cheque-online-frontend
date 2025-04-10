'use client';

import { useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { setCookie } from 'nookies';
const Page = () => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  interface authResponse {
    token: string;
  }

  // Função para formatar o CPF enquanto o usuário digita
  const formatCPF = (value: string) => {
    // Remove todos os caracteres não numéricos
    const cpfNumbers = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos
    const cpfLimited = cpfNumbers.slice(0, 11);
    
    // Formata o CPF (XXX.XXX.XXX-XX)
    if (cpfLimited.length <= 3) {
      return cpfLimited;
    } else if (cpfLimited.length <= 6) {
      return `${cpfLimited.slice(0, 3)}.${cpfLimited.slice(3)}`;
    } else if (cpfLimited.length <= 9) {
      return `${cpfLimited.slice(0, 3)}.${cpfLimited.slice(3, 6)}.${cpfLimited.slice(6)}`;
    } else {
      return `${cpfLimited.slice(0, 3)}.${cpfLimited.slice(3, 6)}.${cpfLimited.slice(6, 9)}-${cpfLimited.slice(9)}`;
    }
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) {
      setError('CPF inválido. Digite um CPF com 11 dígitos.');
      return;
    }
    
    if (!password || password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres.');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      // Importações necessárias no topo do arquivo:
      // import axios from 'axios';
      // import { setCookie } from 'nookies';
      
      setError('');
      
      // Fazendo a requisição POST com axios
      const response = await axios.post<authResponse>('https://api-contra-cheque-online.vercel.app/login/user', {
        cpf: cpf.replace(/\D/g, ''),
        password
      });
      
      // Verificando se a resposta contém um token
      if (response.data && response.data.token) {
        // Armazenando o token em um cookie usando nookies (expira em 1 dia)
        setCookie(null, 'auth_token', response.data.token, {
          maxAge: 86400, // 24 horas em segundos
          path: '/', // Cookie disponível em todas as rotas
          secure: process.env.NODE_ENV === 'production', // Secure em produção
          sameSite: 'strict'
        });
        
        // Redirecionando para a página do usuário
        window.location.href = '/user';
        console.log(response)
      } else {
        setError('Resposta inválida do servidor. Token não encontrado.');
      }
      
      console.log('Login bem-sucedido:', response.data);
    } catch (err: any) {
      // Tratamento de erro mais específico
      if (err.response) {
        // O servidor respondeu com um status de erro
        setError(err.response.data.message || 'Falha na autenticação. Verifique suas credenciais.');
      } else if (err.request) {
        // A requisição foi feita mas não houve resposta
        setError('Servidor indisponível. Tente novamente mais tarde.');
      } else {
        // Erro na configuração da requisição
        setError('Erro ao processar a solicitação.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }

  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-black">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black">Contra-Cheque Online</h1>
          <p className="text-black mt-2">Faça login para acessar seu contra-cheque</p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="cpf" className="block text-black text-sm font-medium mb-2">
              CPF
            </label>
            <input
              id="cpf"
              type="text"
              value={cpf}
              onChange={handleCPFChange}
              placeholder="000.000.000-00"
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
            {/* Removido o link "Esqueci minha senha" */}
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
          {/* Removido o texto "Primeiro acesso? Cadastre-se aqui" */}
        </div>
      </div>
    </div>
  );
};

export default Page;
