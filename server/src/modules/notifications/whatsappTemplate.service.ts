import { WhatsappTemplate } from './whatsappTemplate.model.js';
import { TemplateContent, WhatsappTemplateKey, templateDefinition } from './whatsappTemplates.js';
import { logger } from '../../config/logger.js';

export interface ActiveTemplate extends TemplateContent {
  enabled: boolean;
}

/**
 * The wording to send for a notification: the saved version when there is one, otherwise the
 * default. If the database can't be read the default is used, so a notification still goes out.
 */
export const loadTemplate = async (key: WhatsappTemplateKey): Promise<ActiveTemplate> => {
  const def = templateDefinition(key)!;
  try {
    const saved = await WhatsappTemplate.findOne({ key }).lean();
    if (saved) return { title: saved.title, message: saved.message, details: saved.details ?? [], enabled: saved.enabled !== false };
  } catch (error) {
    logger.error({ err: error, key }, '❌ Could not load WhatsApp template, using the default');
  }
  return { ...def.defaults, details: [...def.defaults.details], enabled: true };
};
