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
  progress?: {
    currentChunk: number;
    totalChunks: number;
    pagesProcessed: number;
    totalPages: number;
  };
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

// Fazer upload do arquivo para o S3 usando a URL pré-assinada
export const uploadToS3 = async (uploadUrl: string, file: File): Promise<boolean> => {
  try {
    // Configuração mínima necessária para o upload
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
      error: errorText
    });

    if (response.status === 403) {
      const errorBody = errorText.includes('<Error>') ? 
        new DOMParser().parseFromString(errorText, 'text/xml') : null;
      const errorCode = errorBody?.querySelector('Code')?.textContent;
      const errorMessage = errorBody?.querySelector('Message')?.textContent;
      
      throw new Error(
        `Erro de permissão no S3: ${errorMessage || 'Acesso negado'}`
      );
    }

    throw new Error(`Erro no upload: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error('Erro no upload para S3:', error);
    throw error;
  }
};

// Iniciar o processamento do arquivo no S3
export const initiateS3Processing = async (
  fileKey: string,
  year: number | string,
  month: number | string,
  authToken: string
): Promise<string> => {
  try {
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
      }
    );

    if (!response.data.jobId) {
      throw new Error('JobId não retornado pelo servidor');
    }

    return response.data.jobId;
  } catch (error) {
    console.error('Erro ao iniciar processamento:', error);
    throw error;
  }
};

// Função para verificar o status do processamento
export const checkProcessingStatus = async (
  jobId: string,
  authToken: string
): Promise<ProcessingStatus> => {
  const response = await axios.get<ProcessingStatus>(
    `https://api-contra-cheque-online.vercel.app/process-s3-upload/status/${jobId}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );
  return response.data;
};

// Função de polling para verificar o status periodicamente
export const pollProcessingStatus = async (
  jobId: string,
  authToken: string,
  onProgress: (status: ProcessingStatus) => void,
  onError: (error: Error) => void,
  onComplete: (result: any) => void
): Promise<void> => {
  try {
    const status = await checkProcessingStatus(jobId, authToken);
    
    switch (status.status) {
      case 'processing':
        onProgress(status);
        // Continua o polling após 2 segundos
        setTimeout(() => pollProcessingStatus(jobId, authToken, onProgress, onError, onComplete), 2000);
        break;
      
      case 'completed':
        onComplete(status.result);
        break;
      
      case 'error':
        onError(new Error(status.error || 'Erro no processamento'));
        break;
    }
  } catch (error) {
    if (error instanceof Error) {
      onError(error);
    } else {
      onError(new Error('Erro desconhecido ao verificar status'));
    }
  }
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