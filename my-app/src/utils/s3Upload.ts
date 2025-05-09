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

// Função para calcular o próximo delay com base no progresso
const calculateNextDelay = (status: ProcessingStatus): number => {
  const baseDelay = status.retryDelay ? status.retryDelay * 1000 : 3000;
  
  // Se o progresso não mudou, aumenta o delay
  if (status.progress === 5) {
    return Math.min(baseDelay * 1.5, 10000); // máximo de 10 segundos
  }
  
  // Se estamos extraindo páginas, aumenta ainda mais o delay
  if (status.currentStep === 'Extraindo páginas do PDF') {
    return Math.min(baseDelay * 2, 15000); // máximo de 15 segundos
  }
  
  return baseDelay;
};

// Função para verificar o status do processamento
export const checkProcessingStatus = async (
  jobId: string,
  authToken: string,
  lastProgress?: number
): Promise<ProcessingStatus> => {
  try {
    console.log(`Verificando status do job ${jobId}`);
    
    const response = await axios.get<ProcessingStatus>(
      `https://api-contra-cheque-online.vercel.app/process-s3-upload/status/${jobId}`,
      { 
        headers: {
          Authorization: `Bearer ${authToken}`,
        }
      }
    );

    const status = response.data;
    console.log('Status recebido:', status);

    // Se o status não mudou, considera como não modificado
    if (lastProgress === status.progress) {
      throw new Error(`NOT_MODIFIED:${calculateNextDelay(status)}`);
    }

    // Calcula o próximo delay com base no status atual
    const nextDelay = calculateNextDelay(status);

    return {
      ...status,
      retryDelay: nextDelay / 1000 // Converte para segundos
    };
  } catch (error: any) {
    if (error.message?.startsWith('NOT_MODIFIED:')) {
      throw error;
    }

    console.error('Erro ao verificar status:', error.response || error);
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
  let lastProgress: number | undefined;
  
  const checkStatusWithBackoff = async () => {
    try {
      const status = await checkProcessingStatus(jobId, authToken, lastProgress);
      lastProgress = status.progress;
      
      switch (status.status) {
        case 'processing':
          onProgress(status);
          const nextDelay = status.retryDelay ? status.retryDelay * 1000 : 3000;
          console.log(`Próxima verificação em ${nextDelay/1000} segundos`);
          setTimeout(checkStatusWithBackoff, nextDelay);
          break;
        
        case 'completed':
          onComplete(status.result);
          break;
        
        case 'error':
          onError(new Error(status.error || 'Erro no processamento'));
          break;
      }
    } catch (error: any) {
      if (error.message?.startsWith('NOT_MODIFIED:')) {
        const delay = parseInt(error.message.split(':')[1]);
        console.log(`Status não modificado, próxima verificação em ${delay/1000} segundos`);
        setTimeout(checkStatusWithBackoff, delay);
        return;
      }

      onError(error instanceof Error ? error : new Error('Erro ao verificar status'));
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
      pollProcessingStatus(
        jobId,
        authToken,
        (status) => {
          if (onProgress) onProgress(status);
        },
        (error) => {
          reject({ success: false, message: error.message, jobId });
        },
        (result) => {
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