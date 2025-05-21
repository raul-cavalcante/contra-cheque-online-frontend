import axios from 'axios';

// Definição de tipos
export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  year: number;
  month: number;
  expiresIn: number;
}

export interface ProcessS3UploadResponse {
  message: string;
  jobId: string;
  status: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: string;
  progress: number;
  result: object | null;
}

// Atualiza a interface de resposta do status para incluir informações de progresso
export interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error';
  message?: string;
  progress?: number;
  currentStep?: string;
  startedAt?: string;
  lastUpdated?: string;
  timeoutAt?: string;
  attempts?: number;
  maxAttempts?: number;
  retryDelay?: number;
  maxRetries?: number;
  maxTime?: number;
  error?: string;
  result?: any;
}

// Tamanho do arquivo limite para usar upload direto ao S3 (4MB)
export const FILE_SIZE_THRESHOLD = 4 * 1024 * 1024;

// Verifica se o arquivo é grande e deve usar upload direto ao S3
export const isLargeFile = (file: File): boolean => {
  return file.size > FILE_SIZE_THRESHOLD;
};

// Validação do tipo de arquivo
export const validateFileType = (file: File): boolean => {
  return file.type === 'application/pdf';
};

// Obter URL pré-assinada para upload ao S3
export const getPresignedUrl = async (
  year: number | string,
  month: number | string,
  contentType: string,
  authToken: string
): Promise<PresignedUrlResponse> => {
  const response = await axios.post<PresignedUrlResponse>(
    'https://api-contra-cheque-online.vercel.app/presigned-url',
    {
      year: Number(year),
      month: Number(month),
      contentType,
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fazer upload do arquivo para o S3 usando a URL pré-assinada
export const uploadToS3 = async (uploadUrl: string, file: File): Promise<boolean> => {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      console.log(`Tentativa ${retries + 1} de upload...`);
      
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf'
        },
        body: file
      });

      if (response.ok) {
        console.log('Upload concluído com sucesso');
        return true;
      }

      const errorText = await response.text();
      console.error('Erro detalhado do S3:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        error: errorText
      });

      if (response.status === 403) {
        throw new Error(`Erro de permissão no S3: ${errorText}`);
      }

      // Se for um erro 5xx, tentamos novamente
      if (response.status >= 500) {
        retries++;
        if (retries < MAX_RETRIES) {
          console.log(`Aguardando ${RETRY_DELAY}ms antes de tentar novamente...`);
          await sleep(RETRY_DELAY);
          continue;
        }
      }

      throw new Error(`Erro no upload: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.error('Erro no upload para S3:', error);
      
      // Se for um erro de rede, tentamos novamente
      if (error instanceof TypeError && error.message.includes('network')) {
        retries++;
        if (retries < MAX_RETRIES) {
          console.log(`Aguardando ${RETRY_DELAY}ms antes de tentar novamente...`);
          await sleep(RETRY_DELAY);
          continue;
        }
      }

      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro desconhecido durante o upload');
    }
  }

  throw new Error(`Upload falhou após ${MAX_RETRIES} tentativas`);
};

// Iniciar o processamento do arquivo no S3
export const initiateS3Processing = async (
  fileKey: string,
  year: number | string,
  month: number | string,
  authToken: string
): Promise<string> => {
  try {
    console.log('Iniciando processamento para:', { fileKey, year, month });
    
    const response = await axios.post<{ jobId: string }>(
      'https://api-contra-cheque-online.vercel.app/process-s3-upload',
      {
        fileKey,
        year: Number(year),
        month: Number(month),
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        validateStatus: (status) => status === 202, // Apenas 202 Accepted é válido
      }
    );

    if (!response.data?.jobId) {
      throw new Error('JobId não retornado pelo servidor');
    }

    console.log('Job iniciado com sucesso:', response.data.jobId);
    return response.data.jobId;
  } catch (error: any) {
    console.error('Erro detalhado ao iniciar processamento:', error.response || error);
    if (error.response?.status === 404) {
      throw new Error('Endpoint de processamento não encontrado. Verifique a configuração do servidor.');
    } else if (error.response?.status === 401) {
      throw new Error('Sessão expirada ou token inválido.');
    }
    throw new Error(`Erro ao iniciar processamento: ${error.message}`);
  }
};

// Constantes para controle de polling
const MIN_DELAY = 3000; // 3 segundos
const MAX_DELAY = 15000; // 15 segundos
const MAX_ATTEMPTS = 100; // número máximo de tentativas
const DELAY_MULTIPLIER = 1.5; // fator de multiplicação para backoff exponencial

// Função para calcular o próximo delay com base no status
const calculateNextDelay = (status: ProcessingStatus, currentDelay: number = MIN_DELAY): number => {
  // Se o servidor retornou um retryDelay específico, use-o
  if (status.retryDelay) {
    return status.retryDelay * 1000;
  }

  // Se o progresso está baixo, use delays mais longos
  if (status.progress && status.progress <= 10) {
    return Math.min(currentDelay * DELAY_MULTIPLIER, MAX_DELAY);
  }

  // Se o progresso é maior que 10%, mantém o delay atual
  return currentDelay;
};

// Função para verificar o status do processamento
export const checkProcessingStatus = async (
  jobId: string,
  authToken: string,
  attempt: number = 1,
  currentDelay: number = MIN_DELAY
): Promise<ProcessingStatus> => {
  if (attempt > MAX_ATTEMPTS) {
    throw new Error('MAX_ATTEMPTS_EXCEEDED');
  }

  try {
    console.log(`Verificando status do job ${jobId} (tentativa ${attempt}/${MAX_ATTEMPTS})`);
    
    // Remove o prefixo 'process:' do jobId se existir
    const cleanJobId = jobId.replace('process:', '');
    
    const response = await axios.get<ProcessingStatus>(
      `https://api-contra-cheque-online.vercel.app/process-s3-upload/status/${cleanJobId}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'If-None-Match': `"${Date.now()}"` // Evita cache
        }
      }
    );

    const status = response.data;
    console.log('Status recebido:', status);

    // Calcula o próximo delay baseado no status atual
    const nextDelay = calculateNextDelay(status, currentDelay);

    if (!status || !status.status) {
      throw new Error('STATUS_INVALID');
    }

    return {
      ...status,
      retryDelay: nextDelay / 1000 // Converte para segundos ao retornar
    };
  } catch (error: any) {
    console.error('Erro ao verificar status:', error.response || error);

    if (error.response?.status === 404) {
      throw new Error('JOB_NOT_FOUND');
    }

    if (error.response?.status === 401) {
      throw new Error('AUTH_ERROR');
    }

    if (error.response?.status === 304) {
      // Se não houve mudança, retorna o status anterior com o próximo delay
      return {
        status: 'processing',
        progress: 0,
        message: 'Em processamento',
        retryDelay: calculateNextDelay({ status: 'processing' }, currentDelay) / 1000
      };
    }

    throw error;
  }
};

// Função de polling para verificar o status periodicamente
export const pollProcessingStatus = async (
  jobId: string,
  authToken: string,
  onProgress: (status: ProcessingStatus) => void,
  onError: (error: Error) => void,
  onComplete: (result: any) => void
): Promise<void> => {
  let attempt = 1;
  let currentDelay = MIN_DELAY;
  let lastProgressTime = Date.now();
  let lastProgress = 0;
  
  const checkStatusWithBackoff = async () => {
    try {
      const status = await checkProcessingStatus(jobId, authToken, attempt, currentDelay);
      
      // Verifica se houve progresso
      if (status.progress !== undefined && status.progress !== lastProgress) {
        lastProgressTime = Date.now();
        lastProgress = status.progress;
      }
      
      // Verifica se o processamento está estagnado
      const stallTime = Date.now() - lastProgressTime;
      if (stallTime > 5 * 60 * 1000) { // 5 minutos sem progresso
        throw new Error('PROCESSING_STALLED');
      }

      switch (status.status) {
        case 'processing':
          onProgress(status);
          currentDelay = status.retryDelay ? status.retryDelay * 1000 : calculateNextDelay(status, currentDelay);
          attempt++;
          console.log(`Próxima verificação em ${currentDelay/1000} segundos`);
          setTimeout(checkStatusWithBackoff, currentDelay);
          break;
        
        case 'completed':
          if (!status.result) {
            onError(new Error('Resultado não encontrado no status completo'));
            break;
          }
          onComplete(status.result);
          break;
        
        case 'error':
          onError(new Error(status.error || 'Erro no processamento'));
          break;

        default:
          onError(new Error(`Status inválido: ${status.status}`));
          break;
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erro desconhecido';
      
      switch (errorMessage) {
        case 'MAX_ATTEMPTS_EXCEEDED':
          onError(new Error('Número máximo de tentativas excedido'));
          break;
        
        case 'JOB_NOT_FOUND':
          onError(new Error('Job não encontrado'));
          break;
        
        case 'AUTH_ERROR':
          onError(new Error('Erro de autenticação - token inválido ou expirado'));
          break;
        
        case 'PROCESSING_STALLED':
          onError(new Error('Processamento paralisado - sem progresso por 5 minutos'));
          break;
        
        case 'STATUS_INVALID':
          onError(new Error('Resposta do servidor inválida'));
          break;
        
        default:
          onError(error instanceof Error ? error : new Error('Erro ao verificar status'));
          break;
      }
    }
  };

  checkStatusWithBackoff();
};

// Função principal para gerenciar todo o processo de upload
export const handleFileUpload = async (
  file: File,
  year: number | string,
  month: number | string,
  authToken: string,
  onProgress?: (status: ProcessingStatus) => void
): Promise<{ success: boolean; message: string; jobId?: string; result?: any }> => {
  try {
    if (!validateFileType(file)) {
      throw new Error('Apenas arquivos PDF são permitidos');
    }

    console.log('Obtendo URL pré-assinada...');
    const presignedData = await getPresignedUrl(year, month, 'application/pdf', authToken);
    
    console.log('Iniciando upload para S3...');
    try {
      const uploadSuccess = await uploadToS3(presignedData.uploadUrl, file);
      if (!uploadSuccess) {
        throw new Error('Falha no upload do arquivo para o S3');
      }
    } catch (uploadError: any) {
      console.error('Erro detalhado do upload:', uploadError);
      throw new Error(`Falha no upload: ${uploadError?.message || 'Erro desconhecido'}`);
    }

    console.log('Upload concluído, iniciando processamento...');
    const jobId = await initiateS3Processing(
      presignedData.fileKey,
      year,
      month,
      authToken
    );

    return new Promise((resolve, reject) => {
      // Timeout global de 5 minutos
      const timeoutId = setTimeout(() => {
        reject({
          success: false,
          message: 'Tempo limite de processamento excedido (5 minutos)',
          jobId
        });
      }, 5 * 60 * 1000);

      let lastProgress: number | undefined;
      let unchangedCount = 0;
      const MAX_UNCHANGED = 10; // Máximo de verificações sem mudança

      pollProcessingStatus(
        jobId,
        authToken,
        (status) => {
          if (onProgress) {
            onProgress(status);
          }

          // Verifica se o progresso mudou
          if (lastProgress === status.progress) {
            unchangedCount++;
            if (unchangedCount >= MAX_UNCHANGED) {
              clearTimeout(timeoutId);
              reject({
                success: false,
                message: 'Processamento paralisado - nenhum progresso detectado',
                jobId
              });
              return;
            }
          } else {
            unchangedCount = 0;
            lastProgress = status.progress;
          }
        },
        (error) => {
          clearTimeout(timeoutId);
          reject({ success: false, message: error.message, jobId });
        },
        (result) => {
          clearTimeout(timeoutId);
          resolve({
            success: true,
            message: 'Upload e processamento concluídos com sucesso',
            jobId,
            result
          });
        }
      );
    });

  } catch (error) {
    console.error('Erro completo:', error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'Erro desconhecido durante o upload' };
  }
};

// Função auxiliar para formato de progresso
export const formatProgress = (progress: number): string => {
  return `${Math.round(progress)}%`;
};

// Upload tradicional (para arquivos pequenos)
export const uploadPayrollFile = async (
  year: number | string,
  month: number | string,
  file: File,
  authToken: string
): Promise<boolean> => {
  try {
    const formData = new FormData();
    formData.append('year', String(year));
    formData.append('month', String(month));
    formData.append('file', file);

    await axios.post('https://api-contra-cheque-online.vercel.app/upload/payroll', formData, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return true;
  } catch (error) {
    console.error('Erro no upload tradicional:', error);
    return false;
  }
};