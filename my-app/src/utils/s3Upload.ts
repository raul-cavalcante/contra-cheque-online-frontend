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

// Tamanho do arquivo limite para usar upload direto ao S3 (4MB)
export const FILE_SIZE_THRESHOLD = 4 * 1024 * 1024;

// Verifica se o arquivo é grande e deve usar upload direto ao S3
export const isLargeFile = (file: File): boolean => {
  return file.size > FILE_SIZE_THRESHOLD;
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
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
    });
    return true;
  } catch (error) {
    console.error('Erro no upload para S3:', error);
    return false;
  }
};

// Iniciar o processamento do arquivo no S3
export const initiateS3Processing = async (
  fileKey: string,
  year: number | string,
  month: number | string,
  authToken: string
): Promise<string | null> => {
  try {
    const response = await axios.post<ProcessS3UploadResponse>(
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

    return response.data.jobId;
  } catch (error) {
    console.error('Erro ao iniciar processamento:', error);
    return null;
  }
};

// Verificar o status do job de processamento
export const checkJobStatus = async (
  jobId: string,
  authToken: string
): Promise<JobStatusResponse> => {
  const response = await axios.get<JobStatusResponse>(
    `https://api-contra-cheque-online.vercel.app/upload/payroll/status/${jobId}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  return response.data;
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