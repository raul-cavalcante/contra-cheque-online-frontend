'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { parseCookies } from 'nookies';
import { useRouter } from 'next/navigation';

// Defina o tipo para os administradores
interface Admin {
  id: string;
  email: string;
  password: string;
}

// Tipo para resposta da URL pré-assinada
interface PresignedUrlResponse { url: string }

const UserDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anos, setAnos] = useState<number[]>([]);
  const [meses, setMeses] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const router = useRouter();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Atualize o estado com o tipo correto
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);

  // Função para obter os anos e meses disponíveis
  const fetchYearMonth = async () => {
    setLoading(true);
    setError('');

    try {
      const cookies = parseCookies();
      const token = cookies.auth_token;

      if (!token) {
        setError('Usuário não autenticado');
        router.push('/');
        return;
      }

      const response = await axios.get('https://api-contra-cheque-online.vercel.app/yearMonth', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;
      if (Array.isArray(data)) {
        const uniqueYears = [...new Set(data.map((item) => item.year))].sort((a, b) => b - a);
        const uniqueMonths = [...new Set(data.map((item) => item.month))].sort((a, b) => a - b);

        setAnos(uniqueYears);
        setMeses(uniqueMonths);
      } else {
        throw new Error('Formato de resposta inválido');
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar anos e meses disponíveis');
    } finally {
      setLoading(false);
    }
  };

  // Função para buscar a lista de contracheques disponíveis
  const fetchPayslips = async () => {
    setLoading(true);
    setError('');
    try {
      const cookies = parseCookies();
      const token = cookies.auth_token;
      if (!token) {
        setError('Usuário não autenticado');
        router.push('/');
        return;
      }
      // Ajuste o endpoint conforme seu backend
      const response = await axios.get('https://api-contra-cheque-online.vercel.app/contra-cheques', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(response.data)) {
        setPayslips(response.data);
        // Atualiza anos e meses disponíveis
        const uniqueYears = [...new Set(response.data.map((item) => item.year))].sort((a, b) => b - a);
        setAnos(uniqueYears);
        setMeses([]); // Limpa meses até selecionar ano
      } else {
        setError('Formato de resposta inválido');
      }
    } catch (err: any) {
      setError('Erro ao buscar contracheques');
    } finally {
      setLoading(false);
    }
  };

  // Atualiza meses disponíveis ao selecionar ano
  useEffect(() => {
    if (selectedYear) {
      const mesesDoAno = payslips.filter((p) => p.year === selectedYear).map((p) => p.month);
      setMeses([...new Set(mesesDoAno)].sort((a, b) => a - b));
    }
  }, [selectedYear, payslips]);

  useEffect(() => {
    fetchYearMonth();
    fetchPayslips();
  }, []);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }

    try {
      setPasswordError('');
      const cookies = parseCookies();
      const token = cookies.auth_token;

      if (!token) {
        setError('Usuário não autenticado');
        router.push('/');
        return;
      }

      await axios.put(
        'https://api-contra-cheque-online.vercel.app/user',
        { currentPassword, newPassword },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSuccessMessage('Sua senha foi atualizada com sucesso');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowChangePasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setPasswordError('Erro ao alterar a senha');
    }
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Contra-Cheque Online</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setShowChangePasswordModal(true)}
              className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-md transition-colors"
            >
              Alterar Senha
            </button>
            <button
              onClick={() => {
                document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                router.push('/');
              }}
              className="text-white border border-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Modal de Alteração de Senha */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Alterar Senha</h2>
            {passwordError && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded-md">
                {passwordError}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-2 bg-green-100 text-black rounded-md">
                {successMessage}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha Atual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-2 text-gray-500"
                  >
                    {showCurrentPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-2 text-gray-500"
                  >
                    {showNewPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-2 text-gray-500"
                  >
                    {showConfirmPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowChangePasswordModal(false)}
                className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Alterar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold mb-6 text-center text-gray-800">
            Consulta de Contra-Cheques
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Seleção de Ano */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                  <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-2">
                    Ano
                  </label>
                  <select
                    id="year"
                    value={selectedYear || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : null;
                      setSelectedYear(value);
                      setSelectedMonth(null);
                      setFilePath(null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  >
                    <option value="">Selecione o ano</option>
                    {anos.map((ano) => (
                      <option key={ano} value={ano}>
                        {ano}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seleção de Mês */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                  <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-2">
                    Mês
                  </label>
                  <select
                    id="month"
                    value={selectedMonth || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : null;
                      setSelectedMonth(value);
                      setFilePath(null);
                    }}
                    disabled={!selectedYear}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black disabled:bg-gray-100"
                  >
                    <option value="">Selecione o mês</option>
                    {selectedYear &&
                      meses.map((mes) => (
                        <option key={mes} value={mes}>
                          {monthNames[mes - 1]}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Botão para baixar o arquivo */}
              <div className="flex justify-center mt-6">
                <button
                  onClick={async () => {
                    if (selectedYear && selectedMonth) {
                      try {
                        setError('');
                        setLoading(true);
                        const cookies = parseCookies();
                        const token = cookies.auth_token;
                        if (!token) {
                          setError('Usuário não autenticado');
                          router.push('/');
                          return;
                        }
                        // Busca o contracheque selecionado
                        const selectedPayslip = payslips.find(
                          (item) => item.year === selectedYear && item.month === selectedMonth
                        );
                        if (!selectedPayslip) {
                          setError('Arquivo não encontrado para o período selecionado');
                          setLoading(false);
                          return;
                        }
                        // Solicita a URL pré-assinada ao backend
                        const { cpf, uuid } = selectedPayslip;
                        const presignedRes = await axios.get<PresignedUrlResponse>(
                          `https://api-contra-cheque-online.vercel.app/api/payslip/presigned-url?cpf=${cpf}&uuid=${uuid}`,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        if (presignedRes.data && typeof presignedRes.data.url === 'string') {
                          window.open(presignedRes.data.url, '_blank');
                        } else {
                          setError('Não foi possível obter a URL de download.');
                        }
                      } catch (err: any) {
                        setError('Erro ao obter a URL de download');
                      } finally {
                        setLoading(false);
                      }
                    } else {
                      setError('Selecione um ano e um mês');
                    }
                  }}
                  disabled={!selectedYear || !selectedMonth}
                  className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-blue-300"
                >
                  Baixar Arquivo
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-4 mt-auto">
        <div className="container mx-auto text-center text-sm">
          <p>© {new Date().getFullYear()} Contra-Cheque Online. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default UserDashboard;


