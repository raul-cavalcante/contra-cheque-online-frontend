'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { parseCookies } from 'nookies';
import { useRouter } from 'next/navigation';

// Interface para representar o formato dos dados da API
interface ContraCheque {
  id: string;
  userId: string;
  createdAt: string;
  month: number;
  year: number;
  fileUrl: string;
}

const UserDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contraCheques, setContraCheques] = useState<ContraCheque[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [meses, setMeses] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const router = useRouter();

  // Função para obter os contra-cheques disponíveis para o usuário
  const fetchContraCheques = async () => {
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

      console.log('Fazendo requisição para obter contra-cheques...');
      
      // Fazendo a requisição para obter os contra-cheques disponíveis para o usuário
      const response = await axios.get('http://localhost:3001/yearMonth', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('Resposta da API:', response.data);
      
      // Verificar se a resposta é um array
      if (Array.isArray(response.data)) {
        // Armazenar os contra-cheques completos
        const contraChequesList = response.data as ContraCheque[];
        setContraCheques(contraChequesList);
        
        // Garantir que todos os contra-cheques tenham year e month válidos
        const validContraCheques = contraChequesList.filter(cc => 
          cc && typeof cc.year === 'number' && typeof cc.month === 'number');

        // Extrair anos únicos
        const uniqueYears = [...new Set(validContraCheques.map(cc => cc.year))];
        // Ordenar anos em ordem decrescente (mais recente primeiro)
        const sortedYears = uniqueYears.sort((a, b) => b - a);

        // Extrair meses únicos
        const uniqueMonths = [...new Set(validContraCheques.map(cc => cc.month))];

        
        console.log('Anos extraídos:', sortedYears);
        console.log('Meses extraídos:', uniqueMonths);
        
        setAnos(sortedYears);
        setMeses(uniqueMonths);
        
        // Seleciona o ano mais recente por padrão, se disponível
        if (sortedYears.length > 0) {
          setSelectedYear(sortedYears[0]); // Primeiro ano (mais recente)
        }
        
        // Seleciona o mês mais recente por padrão, se disponível
        if (uniqueMonths.length > 0 && sortedYears.length > 0) {
          // Encontrar o mês mais recente para o ano selecionado
          const mesesDoAnoMaisRecente = contraChequesList
            .filter(cc => cc.year === sortedYears[0])
            .map(cc => cc.month);
          
          if (mesesDoAnoMaisRecente.length > 0) {
            const mesMaisRecente = Math.max(...mesesDoAnoMaisRecente);
            setSelectedMonth(mesMaisRecente);
          }
        }
      } else {
        throw new Error('Formato de resposta inválido: não é um array');
      }
    } catch (err: any) {
      console.error('Erro completo:', err);
      
      if (err.response?.status === 401) {
        setError('Sessão expirada. Por favor, faça login novamente.');
        router.push('/');
      } else {
        const errorMessage = err.response?.data?.message || err.message || 'Erro desconhecido';
        console.error('Mensagem de erro:', errorMessage);
        setError('Erro ao carregar contra-cheques: ' + errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Função para baixar o contra-cheque selecionado
  const downloadContraCheque = async () => {
    if (!selectedYear || !selectedMonth) {
      setError('Selecione um ano e um mês para baixar o contra-cheque');
      return;
    }
  
    setGenerating(true);
    setError('');
  
    try {
      // Encontrar o contra-cheque correspondente ao ano e mês selecionados
      const selectedContraCheque = contraCheques.find(
        cc => cc.year === selectedYear && cc.month === selectedMonth
      );
  
      if (!selectedContraCheque) {
        throw new Error('Contra-cheque não encontrado para o período selecionado');
      }
  
      // Extrair apenas o fileUrl do contra-cheque selecionado
      const fileUrl = selectedContraCheque.fileUrl;
      console.log(`Baixando contra-cheque: ${fileUrl}`);
      
      const cookies = parseCookies();
      const token = cookies.auth_token;
  
      // Fazer requisição para baixar o arquivo usando a URL do arquivo
      const response = await axios.get<any>(`http://localhost:3001/contra-cheques`, {
        params: {
          fileUrl: fileUrl
        },
        headers: {
          Authorization: `Bearer ${token}`
        },
        responseType: 'blob' // Para baixar o arquivo
      });
  
      console.log('Contra-cheque recebido, iniciando download...');
      
      // Criar um URL para o blob e iniciar o download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Extrair o nome do arquivo da URL
      const fileName = fileUrl.split('\\').pop() || 
                      `contracheque_${selectedYear}_${selectedMonth}.pdf`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      console.log('Download iniciado com sucesso');
    } catch (err: any) {
      console.error('Erro ao baixar contra-cheque:', err);
      
      if (err.response?.status === 401) {
        setError('Sessão expirada. Por favor, faça login novamente.');
        router.push('/');
      } else {
        const errorMessage = err.response?.data?.message || err.message || 'Erro desconhecido';
        setError('Erro ao baixar contra-cheque: ' + errorMessage);
      }
    } finally {
      setGenerating(false);
    }
  };
  

  // Carregar os contra-cheques disponíveis quando o componente montar
  useEffect(() => {
    fetchContraCheques();
  }, []);

  // Nomes dos meses para exibição
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Contra-Cheque Online</h1>
          <button 
            onClick={() => {
              document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
              router.push('/');
            }}
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-md transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

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
            <>
              {contraCheques.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <p>Você ainda não possui contra-cheques disponíveis.</p>
                  <p className="mt-2 text-sm">Entre em contato com o RH para mais informações.</p>
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
                          
                          // Resetar o mês quando o ano mudar
                          setSelectedMonth(null);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                      >
                        <option value="">Selecione o ano</option>
                        {anos.map(ano => (
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
                        }}
                        disabled={!selectedYear}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black disabled:bg-gray-100"
                      >
                        <option value="">Selecione o mês</option>
                        {selectedYear ? (
                          // Filtrar apenas os meses disponíveis para o ano selecionado
                          contraCheques
                            .filter(cc => cc.year === selectedYear)
                            .map(cc => cc.month)
                            .filter((value, index, self) => self.indexOf(value) === index) // Remover duplicados
                            .sort((a, b) => a - b) // Ordenar
                            .map(mes => (
                              <option key={mes} value={mes}>
                                {monthNames[mes - 1]}
                              </option>
                            ))
                        ) : (
                          // Se nenhum ano selecionado, mostrar todos os meses
                          meses.map(mes => (
                            <option key={mes} value={mes}>
                              {monthNames[mes - 1]}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Botão de Download */}
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={downloadContraCheque}
                      disabled={!selectedYear || !selectedMonth || generating}
                      className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-blue-300 flex items-center"
                    >
                      {generating ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></span>
                          Baixando...
                        </>
                      ) : (
                        'Baixar Contra-Cheque'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
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
