import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WhatsappTemplate } from './whatsappTemplate.model.js';
import {
  APPROVED_TEMPLATE,
  LIMITS,
  TemplateContent,
  TemplateDefinition,
  WHATSAPP_TEMPLATES,
  fullMessageText,
  renderMessage,
  sampleValues,
  templateDefinition,
  validateContent,
} from './whatsappTemplates.js';
import { sendWhatsappTemplateChecked, whatsappEnabled } from './whatsapp.js';
import { User } from '../users/user.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { env } from '../../config/env.js';

const contentSchema = z.object({
  title: z.string().max(500),
  message: z.string().max(2000),
  details: z.array(z.string().max(500)).max(20).default([]),
});
const saveSchema = contentSchema.extend({ enabled: z.boolean().default(true) });
const testSchema = contentSchema.extend({ whatsappNumber: z.string().min(1, 'Enter a WhatsApp number') });

const definitionOr404 = (key: string): TemplateDefinition => {
  const def = templateDefinition(key);
  if (!def) throw AppError.notFound('Unknown WhatsApp message');
  return def;
};

const clean = (c: z.infer<typeof contentSchema>): TemplateContent => ({
  title: c.title.trim(),
  message: c.message.trim(),
  details: c.details.map((d) => d.trim()).filter(Boolean),
});

const assertValid = (def: TemplateDefinition, content: TemplateContent): void => {
  const problems = validateContent(def, content);
  if (problems.length) throw AppError.badRequest(problems.join(' '), { problems });
};

const sampleLink = () => `${env.APP_URL.replace(/\/+$/, '')}/incidents/64f1a2b3c4d5e6f7a8b9c0d1`;

const previewOf = (def: TemplateDefinition, content: TemplateContent) => {
  const rendered = renderMessage(content, sampleValues(def));
  return {
    ...rendered,
    recipient: def.sampleRecipient,
    link: sampleLink(),
    fullText: fullMessageText(def.sampleRecipient, rendered.content, sampleLink()),
    problems: validateContent(def, content),
  };
};

/** Every WhatsApp message with its current wording, defaults, placeholders and delivery status. */
export const listTemplates = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const saved = await WhatsappTemplate.find().populate('updatedBy', 'name').lean();
    const templates = WHATSAPP_TEMPLATES.map((def) => {
      const s = saved.find((t) => t.key === def.key);
      const current: TemplateContent = s ? { title: s.title, message: s.message, details: s.details ?? [] } : def.defaults;
      return {
        key: def.key,
        name: def.name,
        sentTo: def.sentTo,
        sentWhen: def.sentWhen,
        variables: def.variables,
        defaults: def.defaults,
        current,
        enabled: s ? s.enabled !== false : true,
        customized: Boolean(s),
        updatedAt: s?.updatedAt ?? null,
        updatedBy: (s?.updatedBy as any)?.name ?? null,
      };
    });
    sendSuccess(res, {
      templates,
      approvedTemplate: { ...APPROVED_TEMPLATE, name: env.WATI_TEMPLATE_NAME || null },
      limits: LIMITS,
      delivery: { enabled: whatsappEnabled(), templateConfigured: Boolean(env.WATI_TEMPLATE_NAME) },
    });
  } catch (error) {
    next(error);
  }
};

/** Renders unsaved wording with sample values, exactly as it would be sent. */
export const previewTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const def = definitionOr404(req.params.key as string);
    sendSuccess(res, previewOf(def, clean(contentSchema.parse(req.body ?? {}))));
  } catch (error) {
    next(error);
  }
};

export const saveTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const def = definitionOr404(req.params.key as string);
    const body = saveSchema.parse(req.body ?? {});
    const content = clean(body);
    assertValid(def, content);

    const previous = await WhatsappTemplate.findOne({ key: def.key }).lean();
    const saved = await WhatsappTemplate.findOneAndUpdate(
      { key: def.key },
      { $set: { ...content, enabled: body.enabled, updatedBy: req.user!.userId } },
      { upsert: true, new: true }
    );
    await recordAuditLog({
      userId: req.user!.userId,
      action: 'WHATSAPP_TEMPLATE_UPDATED',
      entityType: 'WHATSAPP_TEMPLATE',
      entityId: String(saved._id),
      previousValue: previous ? { title: previous.title, message: previous.message, details: previous.details, enabled: previous.enabled } : { ...def.defaults, enabled: true },
      newValue: { key: def.key, ...content, enabled: body.enabled },
      req,
    });
    sendSuccess(res, saved, `"${def.name}" saved`);
  } catch (error) {
    next(error);
  }
};

/** Goes back to the built-in wording (and switches the message back on). */
export const resetTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const def = definitionOr404(req.params.key as string);
    const removed = await WhatsappTemplate.findOneAndDelete({ key: def.key }).lean();
    if (removed) {
      await recordAuditLog({
        userId: req.user!.userId,
        action: 'WHATSAPP_TEMPLATE_RESET',
        entityType: 'WHATSAPP_TEMPLATE',
        entityId: String(removed._id),
        previousValue: { title: removed.title, message: removed.message, details: removed.details, enabled: removed.enabled },
        newValue: { key: def.key, ...def.defaults, enabled: true },
        req,
      });
    }
    sendSuccess(res, { key: def.key, current: def.defaults, enabled: true }, `"${def.name}" reset to default`);
  } catch (error) {
    next(error);
  }
};

/** Sends the (possibly unsaved) wording with sample values to one number, to see it on a real phone. */
export const sendTestTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const def = definitionOr404(req.params.key as string);
    const body = testSchema.parse(req.body ?? {});
    const content = clean(body);
    assertValid(def, content);

    if (!whatsappEnabled()) {
      throw AppError.badRequest('WhatsApp sending is switched off on this server (WHATSAPP_NOTIFICATIONS / WATI settings).');
    }
    if (!env.WATI_TEMPLATE_NAME) {
      throw AppError.badRequest('No approved WATI template is configured (WATI_TEMPLATE_NAME), so a test cannot be sent.');
    }
    const digits = body.whatsappNumber.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) throw AppError.badRequest('Enter the number with country code, e.g. 91 98765 43210.');

    const me = await User.findById(req.user!.userId).select('name');
    const name = me?.name ?? def.sampleRecipient;
    const rendered = renderMessage(content, sampleValues(def));
    const result = await sendWhatsappTemplateChecked(digits, env.WATI_TEMPLATE_NAME, [name, rendered.content, sampleLink()]);
    if (!result.ok) throw AppError.badRequest(`WATI did not accept the message: ${result.error}`);

    await recordAuditLog({
      userId: req.user!.userId,
      action: 'WHATSAPP_TEMPLATE_TEST_SENT',
      entityType: 'WHATSAPP_TEMPLATE',
      entityId: def.key,
      newValue: { key: def.key, to: `…${digits.slice(-4)}` },
      req,
    });
    sendSuccess(res, { sentTo: digits }, `Test message sent to +${digits}`);
  } catch (error) {
    next(error);
  }
};
