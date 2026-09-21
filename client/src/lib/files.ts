import axios from 'axios';
import { api } from './api';

export type AttachmentEntity = 'INCIDENT' | 'INVESTIGATION' | 'RCA' | 'CAPA';

/** Uploads one file; it is linked to its record when that record is saved. */
export const uploadFile = async (file: File, entityType: AttachmentEntity): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', entityType);
  const res: any = await api.post('/attachments', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data;
};

/**
 * Opens an attachment through the access-checked download endpoint.
 * Uses axios directly because the shared client unwraps JSON responses.
 */
export const openAttachment = async (attachment: { _id: string; originalName?: string }): Promise<void> => {
  const res = await axios.get(`/api/v1/attachments/${attachment._id}/download`, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
  });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.download = attachment.originalName || 'attachment';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
