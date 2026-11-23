import { Request, Response, NextFunction, Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { appBase, recordOpened, recordTap, SHORT_CODE } from './shortLink.service.js';
import { logActivity } from '../audit/audit.service.js';

/**
 * GET /l/:code — the short link in a WhatsApp message. Records the tap and redirects to the page.
 * Asks Chrome for the phone model and Android version (client hints); Critical-CH makes Chrome
 * repeat the request once with them, which the service folds into the same tap.
 */
export const followShortLink = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Accept-CH', 'Sec-CH-UA-Model, Sec-CH-UA-Platform-Version');
  res.setHeader('Critical-CH', 'Sec-CH-UA-Model, Sec-CH-UA-Platform-Version');
  res.setHeader('Vary', 'Sec-CH-UA-Model, Sec-CH-UA-Platform-Version');
  const code = String(req.params.code || '');
  let target: string | null = null;
  try {
    if (SHORT_CODE.test(code)) target = await recordTap(code, req);
  } catch {
    target = null;
  }
  res.redirect(302, target || `${appBase()}/`);
};

const openedSchema = z.object({
  screen: z
    .object({ width: z.number().int().min(0).max(20000).optional(), height: z.number().int().min(0).max(20000).optional(), pixelRatio: z.number().min(0).max(10).optional() })
    .optional(),
  timezone: z.string().max(60).optional(),
  installedApp: z.boolean().optional(),
});

/** POST /api/v1/links/:code/opened — the app reports that a page opened from a link (signed in). */
export const reportOpened = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const code = String(req.params.code || '');
    if (!SHORT_CODE.test(code)) {
      sendSuccess(res, { recorded: false });
      return;
    }
    const extra = openedSchema.parse(req.body ?? {});
    const recorded = await recordOpened(code, req.user!.userId, req, extra);
    if (recorded) await logActivity('WHATSAPP_LINK_OPENED', 'Opened a page from a WhatsApp link', { req, meta: { code } });
    sendSuccess(res, { recorded });
  } catch (error) {
    next(error);
  }
};

export const shortLinkRedirectRouter = Router();
shortLinkRedirectRouter.get('/:code', followShortLink);

export const shortLinkApiRouter = Router();
shortLinkApiRouter.post('/:code/opened', authenticate, reportOpened);
