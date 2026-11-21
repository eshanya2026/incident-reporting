import axios from 'axios';
import { api } from './api';
import { showInViewer, useFileViewer } from '../components/ui/FileViewer';

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
 * Opens an attachment in the in-app viewer (images, PDFs... shown first, with a Download button),
 * through the access-checked download endpoint. Uses axios directly because the shared client
 * unwraps JSON responses.
 */
export const openAttachment = async (attachment: { _id: string; originalName?: string; mimeType?: string }): Promise<void> => {
  const name = attachment.originalName || 'attachment';
  useFileViewer.getState().loading(name);
  try {
    const res = await axios.get(`/api/v1/attachments/${attachment._id}/download`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
    });
    showInViewer(res.data, name, attachment.mimeType || String(res.headers['content-type'] || '') || undefined);
  } catch (err) {
    useFileViewer.getState().close();
    throw err;
  }
};
