import api from '@/lib/axios';
import type { ApiResponse } from '@/types/api';

export const submitStudentProfile = async (data: unknown): Promise<ApiResponse<{ studentId: number }>> => {
  const res = await api.post<ApiResponse<{ studentId: number }>>('/students/profile', data);
  return res.data;
};

export const uploadStudentPhoto = async (
  studentId: number,
  documentType: string,
  file: File
): Promise<ApiResponse<any>> => {
  const formData = new FormData();
  formData.append('photo', file);
  const res = await api.post<ApiResponse<any>>(
    `/students/${studentId}/photos/${documentType}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return res.data;
};

export const getStudentPhotos = async (studentId: number): Promise<ApiResponse<any>> => {
  const res = await api.get<ApiResponse<any>>(`/students/${studentId}/photos`);
  return res.data;
};

export const updateStudentStatus = async (status: string): Promise<ApiResponse<any>> => {
  const res = await api.patch<ApiResponse<any>>('/students/status', { status });
  return res.data;
};

export const submitStudentPayment = async (
  payerName: string,
  transactionCode: string,
  file: File
): Promise<ApiResponse<any>> => {
  const formData = new FormData();
  formData.append('payerName', payerName);
  formData.append('transactionCode', transactionCode);
  formData.append('receipt', file);

  const res = await api.post<ApiResponse<any>>('/students/payment', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

export const getStudentPayment = async (): Promise<ApiResponse<any>> => {
  const res = await api.get<ApiResponse<any>>('/students/payment');
  return res.data;
};

export const getStudentProfile = async (): Promise<ApiResponse<any>> => {
  const res = await api.get<ApiResponse<any>>('/students/profile');
  return res.data;
};

